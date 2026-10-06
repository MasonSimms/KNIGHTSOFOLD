import type { Sim } from './world';

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);

/** FNV-1a over the exact bits of every body's pose and velocity, plus HP. Equal hash = identical state. */
export function hashSim(sim: Sim): string {
  let h = 0x811c9dc5;
  const mix = (n: number) => {
    f64[0] = n;
    for (const w of u32) h = Math.imul(h ^ w, 0x01000193) >>> 0;
  };
  mix(sim.frame);
  for (const p of sim.props) { const t = p.body.translation(); mix(t.x); mix(t.y); mix(p.body.rotation()); }
  if (sim.boat) { const b = sim.boat.body, t = b.translation(), v = b.linvel(); mix(t.x); mix(t.y); mix(b.rotation()); mix(v.x); mix(v.y); mix(b.angvel()); }
  for (const f of sim.fighters) {
    mix(f.hp);
    for (const p of f.parts) {
      const t = p.body.translation();
      const v = p.body.linvel();
      mix(t.x); mix(t.y); mix(p.body.rotation()); mix(v.x); mix(v.y); mix(p.body.angvel());
    }
  }
  return h.toString(16);
}
