// Loose objects that can lie around an arena (placeholder sizes). Anything in the world is a physics body: players can pick it up and use it as a club.
export const PROPS: Record<string, { len: number; thick: number; mass: number }> = {
  plank: { len: 0.9, thick: 0.12, mass: 1.0 },
  log: { len: 1.2, thick: 0.2, mass: 2.5 },
  bone: { len: 0.7, thick: 0.1, mass: 0.5 },
};
