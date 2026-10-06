import { mkdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { report, runLab } from './lab';
import type { LabOptions } from './lab';

// npm run lab: bots fight, and reports/BALANCE.md says what happened (see lab.ts). Not part of npm test (it takes a few minutes).
// More rounds = steadier numbers: LAB_SEEDS=6 LAB_ROUNDS=24 npm run lab (PowerShell: $env:LAB_SEEDS=6; npm run lab).
const seeds = Number(process.env.LAB_SEEDS) || 3, rounds = Number(process.env.LAB_ROUNDS) || 24;
const runs: LabOptions[] = [
  { label: '4-player brawls', players: 4, seeds: Array.from({ length: seeds }, (_, i) => 101 + i), rounds, capSeconds: 180 },
  { label: '1 v 1 duels', players: 2, seeds: Array.from({ length: seeds }, (_, i) => 201 + i), rounds, capSeconds: 180 },
];

it('balance lab', async () => {
  mkdirSync('reports', { recursive: true });
  const parts: string[] = [];
  for (const o of runs) {
    const t0 = performance.now();
    const rs = await runLab(o);
    parts.push(report(o, rs, (performance.now() - t0) / 60000));
    console.log(`${o.label}: ${rs.length} rounds done`);
  }
  writeFileSync('reports/BALANCE.md', `${parts.join('\n\n---\n\n')}\n`);
  console.log('Wrote reports/BALANCE.md');
}, 60 * 60 * 1000);
