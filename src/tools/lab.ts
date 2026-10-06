// The balance lab: bots fight a lot of rounds with no screen, and we count what happened. It answers questions nobody has to play to ask:
// how long rounds last against the one-minute target, how people die (knocked off or beaten down), which weapons actually win fights, and
// which eras or maps stall or end in seconds. Bots are not people (they are steadier, and never get bored), so read it for outliers and
// big differences between eras and weapons, not as the final word on feel. Run it with: npm run lab (settings at the bottom of balance.lab.ts).
import { eraById } from '../content/eras';
import { botLook } from '../content/looks';
import { ITEMS } from '../content/props';
import { tuning as T } from '../content/tuning';
import { weapons } from '../content/weapons';
import { eraFor } from '../sim/era';
import { NEUTRAL } from '../sim/types';
import { Sim } from '../sim/world';

export interface LabOptions { seeds: number[]; players: number; rounds: number; capSeconds: number; label: string }

interface Death { cause: string; fell: boolean } // cause: what last hurt them ('club:katana', 'fist', 'slam', 'stomp', 'body'), or 'nothing'
export interface Round { era: string; map: string; seconds: number; capped: boolean; winner: number; deaths: Death[]; hits: number; damage: number }
interface Hit { how: string; w?: string; frame: number }

const KNOCKOFF_MEMORY = 240; // frames: someone falling off within 4 s of being hit was knocked off by that hit
const mapName = (era: string, i: number) => (i === 0 ? eraById(era).arena.name ?? 'main' : (eraById(era).alt?.[i - 1]?.name ?? `map ${i + 1}`));
export const causeName = (c: string) => {
  if (c === 'nothing') return 'fell on their own';
  if (c.startsWith('club:')) return weapons.find((w) => w.id === c.slice(5))?.name ?? ITEMS.find((i) => i.id === c.slice(5))?.name ?? c.slice(5);
  return { fist: 'punches', slam: 'slams and crashes', stomp: 'stomps', body: 'body collisions', club: 'clubs' }[c] ?? c;
};

/** Play `rounds` rounds per seed with every seat a bot (the real game: eras in order, weapons arriving, props lying about). */
export async function runLab(o: LabOptions): Promise<Round[]> {
  const saved = { cg: T.eras.changeGameplay, sp: T.spawn.enabled, ly: T.props.lying, mx: T.eras.mixStarts };
  T.eras.changeGameplay = true; T.spawn.enabled = true; T.props.lying = true; T.eras.mixStarts = true;
  const out: Round[] = [];
  try {
    for (const seed of o.seeds) {
      const sim = await Sim.create(seed, o.players, false);
      sim.looks = sim.looks.map(() => botLook());
      sim.reset();
      const inputs = Array.from({ length: o.players }, () => NEUTRAL);
      for (let r = 0; r < o.rounds; r++) {
        const era = sim.era, map = mapName(sim.era, sim.map), start = sim.frame, last = new Map<number, Hit>(), deaths: Death[] = [];
        let hits = 0, damage = 0, winner = -2;
        const cap = o.capSeconds * 60;
        while (winner === -2 && sim.frame - start < cap) {
          sim.step(inputs);
          for (const e of sim.events) {
            if ((e.t === 'hit' || e.t === 'stomp') && e.victim >= 0 && e.owner !== e.victim) {
              hits++; damage += e.d ?? 0;
              last.set(e.victim, { how: e.how ?? 'body', w: e.w, frame: sim.frame });
            } else if (e.t === 'die' || e.t === 'fall') {
              const h = last.get(e.owner), recent = h && (e.t === 'die' || sim.frame - h.frame <= KNOCKOFF_MEMORY + (sim.arena.sea ? T.swim.frames : 0)); // (in the sea you swim a while before you go under)
              deaths.push({ cause: recent ? (h.how === 'club' && h.w ? `club:${h.w}` : h.how) : 'nothing', fell: e.t === 'fall' });
            } else if (e.t === 'round') winner = e.owner;
          }
        }
        const capped = winner === -2;
        out.push({ era, map, seconds: (sim.frame - start) / 60, capped, winner, deaths, hits, damage });
        // On to the next round: the game starts it itself after showing the result; a round nobody won is ended by the lab.
        if (capped) sim.buildRound(sim.round + 1, eraFor(seed, sim.round + 1).id);
        else for (let k = 0; k < 600 && !sim.events.some((e) => e.t === 'newround') && !sim.matchOver; k++) sim.step(inputs);
        if (sim.matchOver) sim.reseed(seed + 7919 * (r + 1)); // a match is 12 rounds: the next round starts a new match
      }
    }
  } finally {
    T.eras.changeGameplay = saved.cg; T.spawn.enabled = saved.sp; T.props.lying = saved.ly; T.eras.mixStarts = saved.mx;
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-');
const secs = (s: number) => `${s.toFixed(0)} s`;

/** The report, in plain English, as Markdown. */
export function report(o: LabOptions, rounds: Round[], minutes: number): string {
  const L: string[] = [];
  const all = rounds.map((r) => r.seconds), deaths = rounds.flatMap((r) => r.deaths);
  const knockoffs = deaths.filter((d) => d.fell).length, capped = rounds.filter((r) => r.capped).length;
  L.push(`# Balance lab: ${o.label}`, '');
  L.push(`${rounds.length} rounds of ${o.players} bots (seeds ${o.seeds.join(', ')}), the real game: eras in order, weapons arriving, props on the maps. ` +
    `Took ${minutes.toFixed(1)} minutes to run. Bots are steadier than people: read this for outliers, not as the last word on feel.`, '');
  L.push('## The headlines', '');
  L.push(`- **Round length:** ${secs(avg(all))} on average (half the rounds are under ${secs(median(all))}). The target is about a minute.`);
  L.push(`- **How people die:** ${pct(knockoffs, deaths.length)} knocked or fallen off the stage, ${pct(deaths.length - knockoffs, deaths.length)} beaten down.`);
  L.push(`- **Rounds nobody won in ${o.capSeconds} s** (stopped by the lab): ${capped} of ${rounds.length}.`);
  L.push(`- **Draws** (the last two went down together): ${rounds.filter((r) => r.winner === -1).length}.`, '');

  // Per era and map
  const flags: string[] = [];
  L.push('## Eras and maps', '', '| Era | Map | Rounds | Average length | Longest | Knocked off | Hits per round |', '|---|---|---|---|---|---|---|');
  const keys = [...new Set(rounds.map((r) => `${r.era}|${r.map}`))];
  for (const k of keys) {
    const rs = rounds.filter((r) => `${r.era}|${r.map}` === k), ds = rs.flatMap((r) => r.deaths), [era, map] = k.split('|');
    const a = avg(rs.map((r) => r.seconds));
    L.push(`| ${eraById(era).name} | ${map} | ${rs.length} | ${secs(a)} | ${secs(Math.max(...rs.map((r) => r.seconds)))}${rs.some((r) => r.capped) ? ' (stopped)' : ''} | ${pct(ds.filter((d) => d.fell).length, ds.length)} | ${avg(rs.map((r) => r.hits)).toFixed(0)} |`);
    const overall = avg(all); // compared with the other eras (bots fight faster than people, so the one-minute target is not the yardstick here)
    if (rs.length >= 2 && a > overall * 2) flags.push(`${eraById(era).name} (${map}) rounds run long: ${secs(a)} on average, against ${secs(overall)} overall.`);
    if (rs.length >= 2 && a < overall * 0.4) flags.push(`${eraById(era).name} (${map}) rounds are over very fast: ${secs(a)} on average, against ${secs(overall)} overall.`);
    if (ds.length >= 6 && ds.filter((d) => d.cause === 'nothing').length / ds.length > 0.35) flags.push(`${eraById(era).name} (${map}): ${pct(ds.filter((d) => d.cause === 'nothing').length, ds.length)} of deaths are people falling off with nobody near them (a dangerous edge or gap?).`);
  }
  L.push('');

  // What killed people
  L.push('## What finished people off', '', 'The last thing that hurt someone before they died (falling counts if they were hit in the 4 seconds before).', '', '| Cause | Deaths | Share | Of those, knocked off |', '|---|---|---|---|');
  const causes = [...new Set(deaths.map((d) => d.cause))].sort((a, b) => deaths.filter((d) => d.cause === b).length - deaths.filter((d) => d.cause === a).length);
  for (const c of causes) {
    const ds = deaths.filter((d) => d.cause === c);
    L.push(`| ${causeName(c)} | ${ds.length} | ${pct(ds.length, deaths.length)} | ${pct(ds.filter((d) => d.fell).length, ds.length)} |`);
  }
  L.push('');

  // Era weapons in their own era: kills per round, so eras compare fairly
  L.push('## Each era\'s own weapon', '', 'How often the era\'s weapon (the one everyone starts with) finishes someone, per round of that era.', '', '| Era | Weapon | Rounds | Kills by it per round |', '|---|---|---|---|');
  for (const era of [...new Set(rounds.map((r) => r.era))]) {
    const E = eraById(era), rs = rounds.filter((r) => r.era === era), kills = rs.flatMap((r) => r.deaths).filter((d) => d.cause === `club:${E.weapon}`).length;
    L.push(`| ${E.name} | ${causeName(`club:${E.weapon}`)} | ${rs.length} | ${(kills / rs.length).toFixed(2)} |`);
  }
  L.push('');
  L.push('## Things worth a look', '');
  if (capped) flags.unshift(`${capped} round(s) went past ${o.capSeconds} s with nobody winning: bots can stall somewhere.`);
  L.push(...(flags.length ? flags.map((f) => `- ${f}`) : ['- Nothing stood out.']), '');
  return L.join('\n');
}
