import { Container, Graphics, RenderTexture, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { Application } from 'pixi.js';
import { eraById } from '../content/eras';
import { dateOf, paintingFor } from '../content/paintings';
import { tuning as T } from '../content/tuning';
import { wallTile } from '../ui/menu';

// The museum between eras (owner): the frozen end of a round becomes a painting hanging on the museum wall (the camera pulls back from it),
// the round's best moment replays inside that painting, then the camera slides along the wall to the next painting, which is the next era's
// arena with everyone at their starting spots, and zooms into it. The game's whole picture (with its gold frame) is drawn into a texture
// for each painting; this layer draws the wall and the paintings, and moves the "camera" over them.

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // slow in, slow out

const PLACARD = { w: 520, h: 300, share: 0.15 }; // canvas px (drawn big, shown small: sharp at any zoom); its width on the wall, in paintings
const placards = new Map<string, Texture>();
/** The museum label beside a painting (owner: the era's name and its date, nothing else): a cream card in a thin gilt frame, the name, a
 *  rule with a diamond in the era's hot colour, the date in italics. */
export function placard(era: string): Texture {
  const hit = placards.get(era);
  if (hit) return hit;
  const { w, h } = PLACARD, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!, gilt = g.createLinearGradient(0, 0, w, h);
  gilt.addColorStop(0, '#F3D27A'); gilt.addColorStop(0.5, '#B98A2E'); gilt.addColorStop(1, '#6E4E16');
  g.fillStyle = gilt; g.fillRect(0, 0, w, h);
  g.fillStyle = '#F1E8D2'; g.fillRect(14, 14, w - 28, h - 28);
  const name = eraById(era).name;
  let size = 76;
  do g.font = `${size}px "Fell SC", serif`; while (g.measureText(name).width > w - 80 && (size -= 2) > 30);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2A2016'; g.fillText(name, w / 2, h * 0.38);
  g.strokeStyle = '#9A7A3A'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.28, h * 0.6); g.lineTo(w * 0.72, h * 0.6); g.stroke();
  g.fillStyle = paintingFor(era).hot; g.beginPath(); g.moveTo(w / 2, h * 0.6 - 13); g.lineTo(w / 2 + 13, h * 0.6); g.lineTo(w / 2, h * 0.6 + 13); g.lineTo(w / 2 - 13, h * 0.6); g.fill();
  g.font = 'italic 50px Georgia, serif'; g.fillStyle = '#5A4A36'; g.fillText(dateOf(era), w / 2, h * 0.79);
  const t = Texture.from(c);
  if (document.fonts.check('40px "Fell SC"')) placards.set(era, t); // (kept once the museum's font has loaded; before that, drawn again next time)
  return t;
}

export interface MuseumHost {
  app: Application;
  game: Container; // everything the fight draws (it is hidden while the museum is shown)
  box(): { x: number; y: number; w: number; h: number }; // where the game picture is on screen
}

export function createMuseum(host: MuseumHost) {
  const { app } = host, root = new Container();
  root.visible = false;
  app.stage.addChild(root);
  const wallBase = new Graphics(), wall = new TilingSprite({ texture: Texture.from(wallTile()), width: 1, height: 1 });
  const hang = new Container(); // the wall's paintings (moved and scaled as the camera moves)
  root.addChild(wallBase, wall, hang);
  const shadows = [new Graphics(), new Graphics()];
  const paintings = [new Sprite(Texture.EMPTY), new Sprite(Texture.EMPTY)], labels = [new Sprite(Texture.EMPTY), new Sprite(Texture.EMPTY)];
  for (let i = 0; i < 2; i++) hang.addChild(shadows[i], paintings[i], labels[i]);
  let textures: RenderTexture[] = [];

  /** A texture the size of the game picture, for one painting. */
  const fresh = () => { const b = host.box(); return RenderTexture.create({ width: Math.max(2, Math.round(b.w)), height: Math.max(2, Math.round(b.h)), resolution: app.renderer.resolution }); };

  /** The camera: z = how far it has pulled back (1 = the picture fills the screen as in the fight; T.transition.size = hanging on the wall),
   *  slide = how far it has moved along the wall toward the next painting (0..1). */
  function place(z: number, slide: number) {
    const b = host.box(), W = app.screen.width, H = app.screen.height, gap = b.w * (1 + T.transition.gap);
    hang.scale.set(z);
    hang.position.set(b.x + (b.w / 2) * (1 - z) - slide * gap * z, b.y + (b.h / 2) * (1 - z));
    paintings[0].position.set(0, 0); paintings[1].position.set(gap, 0);
    for (let i = 0; i < 2; i++) {
      paintings[i].width = b.w; paintings[i].height = b.h;
      const sh = shadows[i];
      sh.clear().rect(paintings[i].x + b.w * 0.012, b.h * 0.025, b.w, b.h).fill({ color: 0x000000, alpha: 0.45 }); // hung on the wall: a shadow below and to the side
      const lw = b.w * PLACARD.share, lh = (lw * PLACARD.h) / PLACARD.w; // its placard: to the right, level with the bottom of the frame
      labels[i].width = lw; labels[i].height = lh; labels[i].position.set(paintings[i].x + b.w * 1.04, b.h - lh);
      sh.rect(labels[i].x + lw * 0.04, labels[i].y + lh * 0.06, lw, lh).fill({ color: 0x000000, alpha: labels[i].visible ? 0.4 : 0 });
    }
    wallBase.clear().rect(0, 0, W, H).fill(0x16291f);
    wall.width = W; wall.height = H;
    wall.tileScale.set(z * 1.6); // the wall comes closer with the camera too
    wall.tilePosition.set(hang.x, hang.y);
  }

  async function animate(seconds: number, step: (k: number) => void) {
    await new Promise<void>((done) => {
      const t0 = performance.now();
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / 1000 / seconds);
        step(ease(k));
        app.render();
        if (k >= 1) return done();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  return {
    get active() { return root.visible; },
    /** A new texture to draw the game picture into (the renderer's draw takes it as its target). */
    newCanvas: fresh,
    /** The frozen picture becomes the first painting (of `era`), still filling the screen: the museum takes over from the fight. */
    hangNow(tex: RenderTexture, era: string) {
      textures.forEach((t) => t.destroy(true));
      textures = [tex];
      paintings[0].texture = tex; paintings[1].texture = Texture.EMPTY;
      paintings[1].visible = shadows[1].visible = labels[1].visible = false; // (the next painting is hung later)
      labels[0].texture = placard(era); labels[0].visible = true;
      host.game.visible = false;
      root.visible = true;
      place(1, 0);
    },
    /** The next era's painting, hung to the right, with its placard. */
    hangNext(tex: RenderTexture, era: string) { textures.push(tex); paintings[1].texture = tex; labels[1].texture = placard(era); paintings[1].visible = shadows[1].visible = labels[1].visible = true; },
    /** Show the museum as it is now (after redrawing a painting, e.g. a replay playing in it). */
    render() { app.render(); },
    /** The camera pulls back from the painting to see it on the wall. */
    pullBack: () => animate(T.transition.zoomOut, (k) => place(1 + (T.transition.size - 1) * k, 0)),
    /** ...slides along the wall to the next painting... */
    slide: () => animate(T.transition.slide, (k) => place(T.transition.size, k)),
    /** ...and goes into it. */
    zoomIn: () => animate(T.transition.zoomIn, (k) => place(T.transition.size + (1 - T.transition.size) * k, 1)),
    /** Back to the fight. */
    close() {
      root.visible = false;
      host.game.visible = true;
      textures.forEach((t) => t.destroy(true));
      textures = [];
      paintings[0].texture = paintings[1].texture = Texture.EMPTY;
    },
  };
}
export type Museum = ReturnType<typeof createMuseum>;
