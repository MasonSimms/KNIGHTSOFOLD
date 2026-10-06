import { Container, Graphics, RenderTexture, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { Application } from 'pixi.js';
import { tuning as T } from '../content/tuning';
import { wallTile } from '../ui/menu';

// The museum between eras (owner): the frozen end of a round becomes a painting hanging on the museum wall (the camera pulls back from it),
// the round's best moment replays inside that painting, then the camera slides along the wall to the next painting, which is the next era's
// arena with everyone at their starting spots, and zooms into it. The game's whole picture (with its gold frame) is drawn into a texture
// for each painting; this layer draws the wall and the paintings, and moves the "camera" over them.

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // slow in, slow out

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
  const paintings = [new Sprite(Texture.EMPTY), new Sprite(Texture.EMPTY)];
  for (let i = 0; i < 2; i++) hang.addChild(shadows[i], paintings[i]);
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
    /** The frozen picture becomes the first painting, still filling the screen: the museum takes over from the fight. */
    hangNow(tex: RenderTexture) {
      textures.forEach((t) => t.destroy(true));
      textures = [tex];
      paintings[0].texture = tex; paintings[1].texture = Texture.EMPTY;
      paintings[1].visible = shadows[1].visible = false; // (the next painting is hung later)
      host.game.visible = false;
      root.visible = true;
      place(1, 0);
    },
    /** The next era's painting, hung to the right. */
    hangNext(tex: RenderTexture) { textures.push(tex); paintings[1].texture = tex; paintings[1].visible = shadows[1].visible = true; },
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
