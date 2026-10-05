// The flat "source" picture an era backdrop is painted from (port of build_era / build_background in the art package's eras.py and scene.py).
// Drawn in design units (1920 x 1080, the same as the arena at 100 px per metre) onto a 2D canvas of any size, plus:
// - a region map (sky, hills, building, foliage, grass, stone, void) that sets the default brush direction and how soft each part is painted;
// - a pennant mask (the hot accent flies in the wind: its strokes are forced along it, and painted finer);
// - a platform mask (the ground fighters stand on stays sharp when the background is put out of focus).
import type { Mid, Painting } from '../../content/paintings';
import { blur, makeRandom, newImg } from './core';
import type { Img } from './core';
import type { Ctx2D } from './strokes';

export const REG = { sky: 0, hills: 1, castle: 2, foliage: 3, grass: 4, stone: 5, void: 6, fighter: 7 };
export const DEF_DEG = [-9, 0, 4, -40, -80, 0, 8, 0]; // default brush direction per region (degrees)
export const DEF_STD = [9, 5, 6, 45, 18, 5, 8, 0]; // ...and how much it wanders

/** The round's solid ground, in design px: slabs of the main platform, floating ledges (y = top), and the two walls. */
export interface ArenaGeo { slabs: { x: number; w: number }[]; ledges: { x: number; y: number; w: number }[]; top: number; thick: number; walls: { x: number; w: number }[]; wallTop: number }

export interface Source { img: Img; region: Uint8Array; ovAng: Float32Array; ovW: Float32Array; fmask: Float32Array; platMask: Float32Array }

type Pt = [number, number];
const hex = (s: string): [number, number, number] => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const css = (c: [number, number, number], a = 1) => `rgba(${Math.round(Math.min(1, Math.max(0, c[0])) * 255)},${Math.round(Math.min(1, Math.max(0, c[1])) * 255)},${Math.round(Math.min(1, Math.max(0, c[2])) * 255)},${a})`;
const mul = (c: [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];
const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function canvas(w: number, h: number): [OffscreenCanvas, OffscreenCanvasRenderingContext2D] {
  const c = new OffscreenCanvas(w, h);
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}
function poly(c: Ctx2D, pts: Pt[]) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}

export function compose(cfg: Painting, geo: ArenaGeo, W: number, H: number, seed: number): Source {
  const k = W / 1920, R = makeRandom(seed);
  const [, main] = canvas(W, H), [, reg] = canvas(W, H), [, pen] = canvas(W, H);
  for (const c of [main, reg, pen]) c.setTransform(k, 0, 0, k, 0, 0);
  const regFill = (pts: Pt[], r: number) => { reg.fillStyle = `rgb(${r * 30},0,0)`; poly(reg, pts); };
  const regCircle = (x: number, y: number, r: number, id: number) => { reg.fillStyle = `rgb(${id * 30},0,0)`; reg.beginPath(); reg.arc(x, y, r, 0, Math.PI * 2); reg.fill(); };
  /** Draw something on its own layer, soften it (Gaussian, sigma in design px) and lay it over the picture. */
  const soft = (sigma: number, draw: (c: OffscreenCanvasRenderingContext2D) => void) => {
    const [tc, t] = canvas(W, H);
    t.setTransform(k, 0, 0, k, 0, 0);
    draw(t);
    if (sigma * k > 0.3) {
      const id = t.getImageData(0, 0, W, H), d = id.data, N = W * H, P = [new Float32Array(N), new Float32Array(N), new Float32Array(N), new Float32Array(N)];
      for (let i = 0; i < N; i++) { const a = d[4 * i + 3] / 255; P[0][i] = (d[4 * i] / 255) * a; P[1][i] = (d[4 * i + 1] / 255) * a; P[2][i] = (d[4 * i + 2] / 255) * a; P[3][i] = a; }
      const B = P.map((p) => blur(p, W, H, sigma * k));
      for (let i = 0; i < N; i++) { const a = B[3][i]; d[4 * i + 3] = a * 255; if (a > 1e-4) { d[4 * i] = (B[0][i] / a) * 255; d[4 * i + 1] = (B[1][i] / a) * 255; d[4 * i + 2] = (B[2][i] / a) * 255; } }
      t.putImageData(id, 0, 0);
    }
    main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.drawImage(tc, 0, 0); main.restore();
  };

  // --- sky: three-stop gradient, sun or fire glow, clouds ---
  const [top, mid, hor] = cfg.sky.map(hex) as [[number, number, number], [number, number, number], [number, number, number]];
  const sky = main.createLinearGradient(0, 0, 0, 1080);
  for (let i = 0; i <= 16; i++) {
    const y = i / 16, t1 = Math.min(1, y / 0.4), t2 = Math.min(1, Math.max(0, (y - 0.22) / 0.3));
    sky.addColorStop(y, css(lerp3(lerp3(top, mid, t1), hor, t2)));
  }
  main.fillStyle = sky; main.fillRect(0, 0, 1920, 1080);
  regFill([[0, 0], [1920, 0], [1920, 1080], [0, 1080]], REG.sky);
  main.save();
  main.globalCompositeOperation = 'lighter';
  main.translate(cfg.glow.x, cfg.glow.y); main.scale(560, 320);
  const gl = main.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (let i = 0; i <= 8; i++) gl.addColorStop(i / 8, css(mul(cfg.glow.amt, (1 - i / 8) ** 1.7)));
  main.fillStyle = gl; main.beginPath(); main.arc(0, 0, 1, 0, Math.PI * 2); main.fill();
  main.restore();
  const space = cfg.extra?.includes('stars');
  soft(18, (c) => {
    for (let i = 0; i < (space ? 40 : 34); i++) {
      const cx = R.range(-100, 2000), cy = R.range(30, 640), rx = R.range(140, 380), ry = R.range(22, 64), col = hex(cfg.clouds[Math.floor(R.u() * 3)]);
      c.fillStyle = css(col, R.range(0.25, 0.6));
      c.beginPath(); c.ellipse(cx, cy, rx, ry, (R.range(-14, -2) * Math.PI) / 180, 0, Math.PI * 2); c.fill();
    }
  });
  if (cfg.extra?.includes('planet')) soft(1.2, (c) => {
    const g = c.createRadialGradient(1070, 400, 0, 1070, 400, 230 / 0.9);
    g.addColorStop(0, css(hex('#E8A0D8'))); g.addColorStop(1, css(hex('#2A1F6E')));
    c.fillStyle = g; c.beginPath(); c.arc(1150, 470, 200, 0, Math.PI * 2); c.fill();
  });
  if (space) for (let i = 0; i < 160; i++) { main.fillStyle = 'rgb(255,242,217)'; main.beginPath(); main.arc(R.range(0, 1920), R.range(0, 760), R.range(1.2, 3.4), 0, Math.PI * 2); main.fill(); }

  // --- far hills (hazy) ---
  const hill = (base: number, a1: number, a2: number, f1: number, f2: number, ph: number): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 60; i++) { const x = (1920 * i) / 60; pts.push([x, base + a1 * Math.sin(x / f1 + ph) + a2 * Math.sin(x / f2)]); }
    return [...pts, [1920, 1080], [0, 1080]];
  };
  const h1 = hill(700, 40, 25, 260, 90, 0), h2 = hill(770, 30, 18, 200, 70, 1.4);
  soft(2.5, (c) => { c.fillStyle = cfg.hills[0]; poly(c, h1); c.fillStyle = cfg.hills[1]; poly(c, h2); });
  regFill(h1, REG.hills);
  if (cfg.extra?.includes('sea')) { // open sea up to the horizon, with light catching the swell
    soft(2, (c) => {
      const g = c.createLinearGradient(0, 600, 0, 900);
      g.addColorStop(0, '#6FA2AC'); g.addColorStop(1, '#2E6A7A');
      c.fillStyle = g; c.fillRect(0, 600, 1920, 480);
      c.strokeStyle = 'rgba(232,240,224,0.5)'; c.lineWidth = 3;
      for (let i = 0; i < 70; i++) { const x = R.range(0, 1920), y = R.range(610, 860), l = R.range(30, 110); c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y - 2); c.stroke(); }
    });
    regFill([[0, 600], [1920, 600], [1920, 1080], [0, 1080]], REG.hills);
  }

  // --- the building or landmark in the middle distance, and where its pennant flies ---
  let pennant: Pt[] = [], pole: [Pt, Pt] | null = null;
  const flag = (x: number, y: number, s = 1): Pt[] => [[0, 0], [108, -36], [238, -22], [342, -90], [302, -38], [374, -4], [252, 10], [132, 36], [0, 40]].map(([px, py]) => [x + px * s, y + py * s] as Pt);
  const midLayer = (sigma: number, draw: (c: OffscreenCanvasRenderingContext2D, F: (pts: Pt[], col: string) => void) => void) => {
    soft(sigma, (c) => draw(c, (pts, col) => { c.fillStyle = col; poly(c, pts); regFill(pts, REG.castle); }));
  };
  const M: Record<Mid, () => void> = {
    cave: () => {
      midLayer(2.8, (c, F) => {
        F([[380, 760], [470, 430], [640, 330], [860, 300], [1060, 310], [1260, 350], [1440, 470], [1500, 760]], '#6E5440');
        F([[640, 330], [860, 300], [1060, 310], [940, 360]], '#8A6C48');
        F([[760, 760], [760, 560], [830, 470], [960, 430], [1090, 470], [1160, 560], [1160, 760]], '#2A1D14');
      });
      fire(960, 660, 220, 170, [0.95, 0.55, 0.12], 0.85);
      pole = [[1340, 330], [1340, 470]]; pennant = flag(1342, 338);
    },
    pyramid: () => {
      midLayer(2.6, (c, F) => {
        F([[1020, 760], [1340, 300], [1700, 760]], '#C9A66E'); F([[1340, 300], [1700, 760], [1520, 760]], '#9A7A4C'); // far pyramid
        F([[300, 760], [760, 220], [1240, 760]], '#D8B67C'); F([[760, 220], [1240, 760], [1000, 760]], '#A88456');
        for (let i = 1; i < 9; i++) { const y = 220 + i * 60, hw = ((y - 220) / 540) * 460; c.fillStyle = 'rgba(120,90,50,0.35)'; c.fillRect(760 - hw, y, hw * 2, 3); }
      });
      pole = [[760, 150], [760, 225]]; pennant = flag(762, 158, 0.8);
    },
    temple: () => {
      midLayer(2.6, (c, F) => {
        const mar = '#D8CFB4', sh = '#8F846C';
        F([[420, 380], [1500, 380], [960, 250]], mar); F([[960, 250], [1500, 380], [1440, 380]], sh);
        F([[400, 380], [1520, 380], [1520, 420], [400, 420]], mar);
        for (let i = 0; i < 8; i++) { const x0 = 470 + (980 * i) / 7; F([[x0 - 26, 420], [x0 + 26, 420], [x0 + 24, 740], [x0 - 24, 740]], mar); F([[x0 + 6, 420], [x0 + 26, 420], [x0 + 24, 740], [x0 + 6, 740]], sh); }
        F([[420, 740], [1500, 740], [1500, 780], [420, 780]], sh);
      });
      pole = null; pennant = [[900, 430], [1030, 430], [1030, 690], [965, 640], [900, 690]]; // a hanging banner between the columns
    },
    longhall: () => {
      midLayer(2.6, (c, F) => {
        F([[300, 520], [560, 300], [880, 520]], '#C8D2D6'); F([[1100, 560], [1450, 260], [1800, 560]], '#B4C0C6'); // snowy peaks
        F([[520, 740], [520, 520], [1400, 520], [1400, 740]], '#5A4632');
        F([[460, 540], [960, 360], [1460, 540]], '#3E2E20'); F([[480, 520], [960, 350], [1440, 520], [1440, 532], [960, 364], [480, 532]], '#E2E8EA');
        F([[900, 740], [900, 620], [1020, 620], [1020, 740]], '#2A1E14');
        for (const x of [620, 760, 1160, 1300]) F([[x, 600], [x + 40, 600], [x + 40, 650], [x, 650]], '#E9B25A');
        F([[440, 560], [470, 470], [500, 560]], '#3E2E20'); F([[1420, 560], [1450, 470], [1480, 560]], '#3E2E20'); // carved gable ends
      });
      pole = [[1450, 280], [1450, 470]]; pennant = flag(1452, 290, 0.8);
    },
    castle: () => {
      midLayer(2.8, (c, F) => {
        const st = '#6A7880', st2 = '#667379';
        F([[450, 380], [1470, 380], [1470, 740], [450, 740]], st);
        F([[400, 270], [540, 270], [540, 740], [400, 740]], st2); F([[1380, 290], [1520, 290], [1520, 740], [1380, 740]], st2);
        for (const x0 of [400, 1380]) for (let i = 0; i < 4; i++) F([[x0 + i * 36, 270], [x0 + i * 36 + 22, 270], [x0 + i * 36 + 22, 236], [x0 + i * 36, 236]], st2);
        F([[870, 740], [870, 590], [960, 520], [1050, 590], [1050, 740]], '#3B4546');
        for (const [x, y] of [[458, 300], [461, 400], [1410, 330]]) F([[x, y], [x + 20, y], [x + 20, y + 44], [x, y + 44]], '#E9B25A');
        F([[450, 380], [1470, 380], [1470, 404], [450, 404]], '#6F797B');
      });
      fire(680, 590, 150, 150, [0.55, 0.34, 0.08], 0.6); fire(1240, 590, 150, 150, [0.55, 0.34, 0.08], 0.6);
      pole = [[1450, 205], [1450, 300]]; pennant = [[1452, 222], [1560, 184], [1690, 196], [1800, 122], [1748, 176], [1822, 214], [1700, 238], [1580, 262], [1452, 264]];
    },
    pagoda: () => {
      midLayer(2.6, (c, F) => {
        const wood = '#5A3A34', roof = '#3A2A30', lt = '#E8C8A8';
        for (let i = 0; i < 4; i++) {
          const y = 700 - i * 120, hw = 230 - i * 38;
          F([[960 - hw * 0.62, y], [960 + hw * 0.62, y], [960 + hw * 0.62, y - 80], [960 - hw * 0.62, y - 80]], wood);
          for (let j = -1; j <= 1; j++) F([[960 + j * hw * 0.32 - 14, y - 64], [960 + j * hw * 0.32 + 14, y - 64], [960 + j * hw * 0.32 + 14, y - 30], [960 + j * hw * 0.32 - 14, y - 30]], lt);
          F([[960 - hw - 30, y - 70], [960 - hw * 0.55, y - 112], [960 + hw * 0.55, y - 112], [960 + hw + 30, y - 70], [960 + hw, y - 82], [960 - hw, y - 82]], roof);
        }
        F([[950, 230], [970, 230], [966, 130], [954, 130]], roof);
        F([[700, 760], [700, 700], [1220, 700], [1220, 760]], '#4A3430');
        F([[260, 760], [470, 420], [700, 760]], '#B898B0'); F([[1300, 760], [1560, 380], [1820, 760]], '#A88CA0'); // far mountains
      });
      pole = [[1150, 470], [1150, 600]]; pennant = flag(1152, 478, 0.7);
    },
    ship: () => {
      midLayer(2.6, (c, F) => {
        const hull = '#4A3424', sail = '#E8E0C8', sailSh = '#B8B098';
        F([[560, 610], [1420, 610], [1340, 700], [640, 700]], hull);
        F([[1300, 610], [1460, 560], [1470, 610]], hull); F([[560, 610], [520, 570], [600, 570], [640, 610]], hull);
        for (const [x, top, w] of [[760, 260, 170], [980, 200, 200], [1200, 280, 160]] as [number, number, number][]) {
          F([[x - 5, 610], [x + 5, 610], [x + 5, top], [x - 5, top]], '#2E2018');
          F([[x - w / 2, top + 30], [x + w / 2, top + 30], [x + w / 2 + 14, top + 150], [x - w / 2 + 6, top + 150]], sail);
          F([[x - w / 2 + 6, top + 170], [x + w / 2 + 10, top + 170], [x + w / 2 + 22, top + 300], [x - w / 2 + 2, top + 300]], sail);
          F([[x + w / 4, top + 30], [x + w / 2, top + 30], [x + w / 2 + 14, top + 150], [x + w / 4 + 6, top + 150]], sailSh);
        }
        F([[300, 700], [420, 660], [520, 700]], '#4E6464'); // a rock in the sea
      });
      pole = [[980, 120], [980, 205]]; pennant = flag(982, 128, 0.75);
    },
    mesa: () => {
      midLayer(2.6, (c, F) => {
        F([[300, 760], [380, 420], [700, 400], [760, 760]], '#B0704E'); F([[380, 420], [700, 400], [690, 430], [390, 446]], '#D8A070');
        F([[1100, 760], [1160, 470], [1380, 460], [1420, 330], [1600, 320], [1660, 760]], '#A06446'); F([[1420, 330], [1600, 320], [1596, 350], [1426, 356]], '#D09A66');
        for (const x of [880, 1010]) { F([[x - 12, 760], [x + 12, 760], [x + 12, 600], [x - 12, 600]], '#4E6A3A'); F([[x - 46, 680], [x - 12, 680], [x - 12, 666], [x - 34, 666], [x - 34, 630], [x - 46, 630]], '#4E6A3A'); }
      });
      pole = [[1520, 200], [1520, 330]]; pennant = flag(1522, 208, 0.7);
    },
    fort: () => {
      midLayer(2.6, (c, F) => {
        const st = '#5E584F', st2 = '#58534A', dk = '#35322D';
        F([[330, 560], [1520, 560], [1520, 760], [330, 760]], st);
        F([[330, 480], [520, 480], [520, 760], [330, 760]], st2); F([[1330, 450], [1560, 450], [1560, 760], [1330, 760]], st2);
        for (const x0 of [330, 1330]) for (let i = 0; i < 4; i++) F([[x0 + i * 56, 450], [x0 + i * 56 + 30, 450], [x0 + i * 56 + 30, 420], [x0 + i * 56, 420]], st2);
        F([[760, 640], [980, 610], [985, 640], [765, 670]], dk);
        c.fillStyle = dk; c.beginPath(); c.arc(800, 690, 34, 0, Math.PI * 2); c.fill();
      });
      pole = [[1445, 260], [1445, 450]]; pennant = flag(1448, 274);
    },
    huts: () => {
      midLayer(2.6, (c, F) => {
        for (const [x, s] of [[620, 1], [1240, 0.85]] as [number, number][]) {
          for (const dx of [-110, -40, 40, 110]) F([[x + dx * s - 6, 760], [x + dx * s + 6, 760], [x + dx * s + 6, 600 - 40 * (1 - s)], [x + dx * s - 6, 600 - 40 * (1 - s)]], '#3A2E1E');
          F([[x - 150 * s, 600], [x + 150 * s, 600], [x + 140 * s, 480], [x - 140 * s, 480]], '#6A5432');
          F([[x - 200 * s, 490], [x, 360 + 40 * (1 - s)], [x + 200 * s, 490]], '#A08A4A');
        }
        F([[840, 760], [900, 420], [960, 760]], '#2E4630'); F([[1500, 760], [1560, 380], [1620, 760]], '#2E4630'); // palms in the mist
      });
      pole = [[620, 280], [620, 380]]; pennant = flag(622, 288, 0.7);
    },
    ruins: () => {
      midLayer(2.4, (c, F) => {
        const cn = '#6E7A82', cn2 = '#636E75', cd = '#38424A';
        for (const [x0, x1, yt] of [[380, 640, 340], [640, 880, 470], [880, 1120, 300], [1120, 1380, 430], [1380, 1560, 380]] as [number, number, number][]) {
          F([[x0, 760], [x0, yt], [x0 + (x1 - x0) * 0.3, yt - 30], [x0 + (x1 - x0) * 0.55, yt + 20], [x1, yt - 10], [x1, 760]], Math.floor(x0 / 10) % 2 ? cn : cn2);
          for (let wy = yt + 60; wy < 740; wy += 80) for (let wx = x0 + 30; wx < x1 - 30; wx += 70) F([[wx, wy], [wx + 28, wy], [wx + 28, wy + 40], [wx, wy + 40]], R.u() > 0.12 ? cd : '#E8B05A');
        }
      });
      pole = [[1000, 260], [1000, 330]]; pennant = flag(1002, 268, 0.85);
    },
    station: () => {
      midLayer(1.8, (c, F) => {
        const mt = '#2E2A6B', fr = '#161446';
        F([[300, 200], [420, 160], [1500, 160], [1620, 200], [1620, 250], [300, 250]], fr);
        F([[300, 200], [390, 200], [390, 780], [300, 780]], fr); F([[1530, 200], [1620, 200], [1620, 780], [1530, 780]], fr);
        F([[300, 740], [1620, 740], [1620, 780], [300, 780]], fr);
        for (const x of [390, 1530]) F([[x - 26, 250], [x + 26, 250], [x + 26, 740], [x - 26, 740]], mt);
        F([[390, 250], [1530, 250], [1530, 274], [390, 274]], mt);
      });
      pole = [[960, 236], [960, 330]]; pennant = flag(962, 262, 0.85);
    },
    skyline: () => {
      midLayer(2.2, (c, F) => {
        const cols = ['#2A2436', '#322A40', '#241E30'];
        let x = 260;
        while (x < 1700) {
          const w = R.range(110, 200), t = R.range(240, 520), col = cols[Math.floor(R.u() * 3)];
          F([[x, 760], [x, t], [x + w, t], [x + w, 760]], col);
          for (let wy = t + 30; wy < 730; wy += 46) for (let wx = x + 16; wx < x + w - 24; wx += 34) if (R.u() < 0.35) F([[wx, wy], [wx + 16, wy], [wx + 16, wy + 24], [wx, wy + 24]], R.u() < 0.8 ? '#E8B05A' : '#F0D890');
          x += w + R.range(6, 30);
        }
      });
      pole = [[1500, 200], [1500, 300]]; pennant = flag(1502, 208, 0.7);
    },
  };
  /** A warm light (fire, torches) added on top. */
  function fire(x: number, y: number, rx: number, ry: number, col: [number, number, number], amt: number) {
    main.save(); main.globalCompositeOperation = 'lighter'; main.translate(x, y); main.scale(rx, ry);
    const g = main.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, css(mul(col, amt * (1 - i / 6) ** 1.4)));
    main.fillStyle = g; main.beginPath(); main.arc(0, 0, 1, 0, Math.PI * 2); main.fill(); main.restore();
  }
  M[cfg.mid]();
  if (cfg.extra?.includes('smoke')) soft(26, (c) => { for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(207,198,180,0.35)'; c.beginPath(); c.arc(R.range(300, 1700), R.range(300, 650), R.range(60, 150), 0, Math.PI * 2); c.fill(); } });

  // --- masses at both sides: foliage (round) or blocks, lit from the upper left ---
  const pal = cfg.side;
  soft(1.5, (c) => {
    if (cfg.trunk) { c.fillStyle = cfg.trunk; poly(c, [[0, 260], [100, 260], [120, 980], [0, 980]]); poly(c, [[1800, 250], [1920, 250], [1920, 980], [1820, 980]]); }
    const blobs = (x0: number, x1: number, y0: number, y1: number, n: number, flip: boolean) => {
      for (let i = 0; i < n; i++) {
        const x = R.range(x0, x1), y = R.range(y0, y1), r = R.range(28, 78);
        const lit = (1 - (y - y0) / (y1 - y0)) * 0.55 + ((x < (x0 + x1) / 2) !== flip ? 0.25 : 0);
        c.fillStyle = pal[Math.round(Math.min(5, Math.max(0, R.normal() + lit * 5)))];
        if (cfg.blocky) { const w = r * R.range(0.8, 1.6), h = r * R.range(0.6, 1.4); c.fillRect(x - w, y - h, w * 2, h * 2); regFill([[x - w, y - h], [x + w, y - h], [x + w, y + h], [x - w, y + h]], REG.foliage); }
        else { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); regCircle(x, y, r, REG.foliage); }
      }
    };
    blobs(-60, 360, 120, 900, 120, false);
    blobs(1560, 1980, 110, 900, 120, true);
  });

  // --- the hot accent: a pennant (or banner) ---
  const pl = pole as [Pt, Pt] | null; // (set inside the landmark painters above)
  if (pl) { main.strokeStyle = 'rgb(43,31,20)'; main.lineWidth = 7; main.beginPath(); main.moveTo(pl[0][0], pl[0][1]); main.lineTo(pl[1][0], pl[1][1]); main.stroke(); }
  if (pennant.length) {
    const hot = hex(cfg.hot);
    main.fillStyle = css(hot); poly(main, pennant);
    const n = pennant.length; // a shaded fold along the lower half
    main.fillStyle = css(mul(hot, 0.68)); poly(main, [[pennant[0][0] + 4, pennant[0][1] + (pennant[n - 1][1] - pennant[0][1]) * 0.7], [pennant[2][0], pennant[2][1] + (pennant[n - 2][1] - pennant[2][1]) * 0.7], pennant[n - 2], pennant[n - 1]]);
    pen.fillStyle = '#fff'; poly(pen, pennant);
  }

  // --- the misty void below the stage ---
  const vg = main.createLinearGradient(0, 860, 0, 1080);
  vg.addColorStop(0, css(hex(cfg.void[0]), 0)); vg.addColorStop(1, css(hex(cfg.void[1]), 0.95));
  main.fillStyle = vg; main.fillRect(0, 860, 1920, 220);
  regFill([[0, 870], [1920, 870], [1920, 1080], [0, 1080]], REG.void);
  soft(16, (c) => { for (let i = 0; i < 10; i++) { c.fillStyle = css(hex(cfg.mist), 0.4); c.beginPath(); c.ellipse(R.range(100, 1800), R.range(900, 1060), R.range(150, 380), R.range(14, 30), 0, 0, Math.PI * 2); c.fill(); } });

  // --- the round's real ground: platforms, ledges and walls (sharp: the fighters stand on these) ---
  const pc = cfg.plat;
  const slab = (x0: number, x1: number, y0: number, th: number) => {
    main.fillStyle = pc.face; poly(main, [[x0, y0], [x1, y0], [x1, y0 + th], [x0, y0 + th]]);
    main.fillStyle = pc.dark; poly(main, [[x0, y0 + th * 0.62], [x1, y0 + th * 0.62], [x1, y0 + th], [x0, y0 + th]]);
    const n = Math.max(1, Math.round((x1 - x0) / 130));
    main.fillStyle = pc.seam;
    for (let i = 1; i < n; i++) { const x = x0 + (i * (x1 - x0)) / n; poly(main, [[x - 3, y0 + th * 0.1], [x + 3, y0 + th * 0.1], [x + 3, y0 + th * 0.62], [x - 3, y0 + th * 0.62]]); }
    main.fillStyle = pc.lipdark; poly(main, [[x0 - 6, y0 - 4], [x1 + 6, y0 - 4], [x1 + 6, y0 + th * 0.22], [x0 - 6, y0 + th * 0.22]]);
    main.fillStyle = pc.lip; poly(main, [[x0, y0 - 6], [x1, y0 - 6], [x1, y0 + 2], [x0, y0 + 2]]);
    regFill([[x0 - 6, y0 - 6], [x1 + 6, y0 - 6], [x1 + 6, y0 + th * 0.22], [x0 - 6, y0 + th * 0.22]], REG.grass);
    regFill([[x0, y0 + th * 0.22], [x1, y0 + th * 0.22], [x1, y0 + th], [x0, y0 + th]], REG.stone);
  };
  for (const w of geo.walls) { // a stone pillar, lit from the left
    main.fillStyle = pc.face; poly(main, [[w.x, geo.wallTop], [w.x + w.w, geo.wallTop], [w.x + w.w, 1080], [w.x, 1080]]);
    main.fillStyle = pc.dark; poly(main, [[w.x + w.w * 0.55, geo.wallTop], [w.x + w.w, geo.wallTop], [w.x + w.w, 1080], [w.x + w.w * 0.55, 1080]]);
    main.fillStyle = pc.lip; poly(main, [[w.x - 4, geo.wallTop - 6], [w.x + w.w + 4, geo.wallTop - 6], [w.x + w.w + 4, geo.wallTop + 8], [w.x - 4, geo.wallTop + 8]]);
    regFill([[w.x - 4, geo.wallTop - 6], [w.x + w.w + 4, geo.wallTop - 6], [w.x + w.w + 4, 1080], [w.x - 4, 1080]], REG.stone);
  }
  for (const s of geo.slabs) slab(s.x, s.x + s.w, geo.top, geo.thick);
  for (const l of geo.ledges) slab(l.x, l.x + l.w, l.y, 30);

  if (cfg.extra?.includes('rain')) { main.strokeStyle = 'rgba(217,230,242,0.22)'; main.lineWidth = 2; for (let i = 0; i < 260; i++) { const x = R.range(0, 1920), y = R.range(0, 1080), L = R.range(40, 90); main.beginPath(); main.moveTo(x, y); main.lineTo(x - L * 0.18, y + L); main.stroke(); } }
  if (cfg.extra?.includes('snow')) { main.fillStyle = 'rgba(245,248,250,0.7)'; for (let i = 0; i < 220; i++) { main.beginPath(); main.arc(R.range(0, 1920), R.range(0, 1000), R.range(2, 5), 0, Math.PI * 2); main.fill(); } }

  // --- read everything back ---
  const N = W * H, img = newImg(W, H), d = main.getImageData(0, 0, W, H).data, rd = reg.getImageData(0, 0, W, H).data, pd = pen.getImageData(0, 0, W, H).data;
  const region = new Uint8Array(N), ovAng = new Float32Array(N), ovW = new Float32Array(N), fmask = new Float32Array(N), plat = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    img.c[0][i] = d[4 * i] / 255; img.c[1][i] = d[4 * i + 1] / 255; img.c[2][i] = d[4 * i + 2] / 255;
    const r = Math.min(7, Math.round(rd[4 * i] / 30));
    region[i] = r;
    if (r === REG.stone || r === REG.grass) plat[i] = 1;
    const p = pd[4 * i + 3] / 255;
    if (p > 0.4) { ovAng[i] = (-14 * Math.PI) / 180; ovW[i] = 0.95; fmask[i] = 0.7; }
  }
  return { img, region, ovAng, ovW, fmask, platMask: plat };
}
