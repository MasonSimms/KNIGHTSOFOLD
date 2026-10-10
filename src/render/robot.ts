import { Container, Graphics } from 'pixi.js';

// How a bot looks (owner: shades of gray, a classic robot, in every era). Its body is painted gray like anyone's; this is the robot head that
// sits over the head ball in place of a hat and eyes: a boxy steel faceplate, an antenna with a red bulb, square glowing eyes and a mouth
// grille. Crisp vector like the eyes (the art guide keeps eyes out of the paint). Drawn facing right; the caller flips it with the facing.

const BIG = 100; // drawn large, then scaled down: small vector shapes come out crisp

export function drawRobotHead(headR: number, gray: number): Container {
  const c = new Container(), g = new Graphics(), r = headR * BIG;
  const steel = gray, dark = 0x2a2d31, glow = 0x8ff0ff;
  g.roundRect(-r * 1.05, -r * 1.0, r * 2.1, r * 1.95, r * 0.28).fill(steel).stroke({ width: r * 0.08, color: dark }); // the box
  g.moveTo(0, -r * 1.0).lineTo(0, -r * 1.65).stroke({ width: r * 0.1, color: dark }); // antenna
  g.circle(0, -r * 1.72, r * 0.17).fill(0xd8402a); // ...and its bulb
  g.circle(-r * 1.08, -r * 0.05, r * 0.16).fill(dark).circle(r * 1.08, -r * 0.05, r * 0.16).fill(dark); // bolts on the sides
  g.roundRect(-r * 0.62, -r * 0.42, r * 0.5, r * 0.36, r * 0.06).fill(dark).roundRect(r * 0.18, -r * 0.42, r * 0.5, r * 0.36, r * 0.06).fill(dark); // eye sockets
  g.rect(-r * 0.52, -r * 0.34, r * 0.3, r * 0.2).fill(glow).rect(r * 0.28, -r * 0.34, r * 0.3, r * 0.2).fill(glow); // glowing eyes
  for (let i = -2; i <= 2; i++) g.rect(r * (0.02 + i * 0.16) - r * 0.04, r * 0.3, r * 0.08, r * 0.32).fill(dark); // mouth grille
  g.scale.set(1 / BIG);
  c.addChild(g);
  return c;
}
