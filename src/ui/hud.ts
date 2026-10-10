import { BOT_GRAYS, COLORS } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { paintPortrait, PORTRAIT } from '../render/portrait';
import { paintedSplats, paintKnobs } from '../render/painter/sprites';
import type { Sim } from '../sim/world';
import { wallUrl } from './menu';

// What is drawn over a real fight (2-4 players). Owner: as little text as possible. The scoreboard is each player's colour and their
// rounds won, with a pip for every round of the match; a round ends with a short banner ("Red wins!") and, between eras, score cards
// under the painting; the match ends with the victory wall (the champion crowned under a lamp, the others hung crooked). No words.
const score = document.getElementById('score') as HTMLElement;
const banner = document.getElementById('banner') as HTMLElement;
const hint = document.getElementById('hint') as HTMLElement | null;
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
let lastScore = '', lastBanner = '', podiumKey = '', podium: HTMLElement | null = null;

/** A player's name and colour (a bot: Bot 1, 2... in shades of gray). */
const nameOf = (sim: Sim, i: number) => (sim.looks[i]?.bot ? { name: 'Bot ' + (1 + sim.looks.slice(0, i).filter((l) => l.bot).length), hex: BOT_GRAYS[i % BOT_GRAYS.length] } : COLORS[sim.looks[i]?.color ?? i]);

export function updateHud(sim: Sim): void {
  if (hint) hint.style.display = sim.matchActive ? 'none' : ''; // the controls help: in practice only
  if (!sim.matchActive) {
    if (lastScore !== '') { score.innerHTML = ''; banner.textContent = ''; lastScore = lastBanner = ''; }
    showPodium(sim, false);
    return;
  }
  const players = sim.fighters.filter((f) => f.controlled && !sim.gone[f.index]); // (online: empty seats are not shown)
  const R = T.match.rounds, pips = Array.from({ length: R }, (_, i) => `<i class="${i + 1 < sim.round || (i + 1 === sim.round && sim.roundOver) ? 'on' : i + 1 === sim.round ? 'now' : ''}"></i>`).join('') + (sim.tieBreak ? '<i class="tie"></i>' : '');
  const html = players.map((f) => `<span class="pl"><b style="color:${hex(nameOf(sim, f.index).hex)}">&#9679;</b>${sim.scores[f.index]}</span>`).join('') + `<span class="pips">${pips}</span>`;
  if (html !== lastScore) { score.innerHTML = html; lastScore = html; }
  const N = T.match.quick.number, count = Math.ceil(sim.countdown / N); // the countdown at a round's start: 3, 2, 1 (no words)
  const text = count > 0 && count <= 3 ? String(count) : sim.roundOver && !sim.matchOver ? (sim.roundWinner >= 0 ? `${nameOf(sim, sim.roundWinner).name} wins!` : 'Draw!') : '';
  if (text !== lastBanner) { banner.textContent = text; banner.classList.toggle('count', count > 0 && count <= 3); banner.style.color = sim.roundOver && sim.roundWinner >= 0 ? hex(nameOf(sim, sim.roundWinner).hex) : sim.roundOver ? '#fff' : ''; lastBanner = text; }
  showPodium(sim, sim.matchOver);
}

// The quick break between two rounds of one era (owner, 2026-10-09): the museum's wall swept across the picture like one broad brushstroke,
// and on off the other side once the next arena is set up behind it (main.ts quickBreak).
let wipe: HTMLElement | null = null;
/** The wall sweeps across: resolves once it covers the picture. */
export function wipeIn(): Promise<void> {
  if (!wipe) { wipe = document.createElement('div'); wipe.id = 'wipe'; document.body.appendChild(wipe); }
  wipe.style.setProperty('--wall', `url(${wallUrl()})`); wipe.style.setProperty('--t', `${T.match.quick.wipe}s`);
  wipe.className = ''; void wipe.offsetWidth; // (back off to the left at once)
  wipe.className = 'on';
  return new Promise((ok) => setTimeout(ok, T.match.quick.wipe * 1000));
}
/** ...and on away, uncovering the next round. */
export function wipeOut(): void { if (wipe?.className === 'on') wipe.className = 'off'; }

/** Take the round's banner away (the museum slides on to the next painting: it belongs to the one before). */
export function clearBanner(): void { banner.textContent = ''; lastBanner = ''; }

// The round break (owner, 2026-10-07): while the round hangs as a painting on the museum wall, a little gilt-framed card per player: their
// portrait from the Hall and a gold coin for every round won (the round winner's newest dropping in), the leader's frame glowing, and a red
// splat across the card of whoever went out last. No words.
let cards: HTMLElement | null = null;
export function showCards(sim: Sim): void {
  const players = sim.fighters.filter((f) => f.controlled && !sim.gone[f.index]);
  const top = Math.max(0, ...players.map((f) => sim.scores[f.index]));
  const out = players.filter((f) => f.limp && f.index !== sim.roundWinner).sort((a, b) => b.deadAt - a.deadAt)[0]?.index ?? -1; // knocked off last
  if (!cards) { cards = document.createElement('div'); cards.id = 'cards'; document.body.appendChild(cards); }
  cards.innerHTML = players.map((f) => {
    const n = sim.scores[f.index], coins = Array.from({ length: n }, (_, k) => `<i${f.index === sim.roundWinner && k === n - 1 ? ' class="new"' : ''}></i>`).join('');
    return `<div class="card${top > 0 && n === top ? ' lead' : ''}"><canvas width="${PORTRAIT.w}" height="${PORTRAIT.h}"></canvas>${f.index === out ? '<canvas class="splat" width="112" height="144"></canvas>' : ''}<div class="coins">${coins}</div></div>`;
  }).join('');
  cards.style.display = 'flex';
  cards.querySelectorAll('.card').forEach((card, k) => {
    const portrait = card.querySelector('canvas')!, splat = card.querySelector<HTMLCanvasElement>('canvas.splat');
    void paintPortrait({ ...sim.looks[players[k].index] }, players[k].index).then((v) => portrait.getContext('2d')!.drawImage(v[0], 0, 0));
    if (splat) redSplat(splat, 0);
  });
}
export function hideCards(): void { if (cards) cards.style.display = 'none'; }

/** The knock-off paint (painter/sprites.ts paintedSplats, white; splat n of them) in red, keeping its brushwork, on a canvas. */
function redSplat(c: HTMLCanvasElement, n: number): void {
  const all = paintedSplats(paintKnobs()), src = all[n % all.length].source.resource as CanvasImageSource, g = c.getContext('2d')!;
  g.drawImage(src, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = '#C8282C'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0, c.width, c.height);
}

/**
 * The end of a match, the victory wall (owner's visuals handoff, no heading, no words): the champion's portrait, crowned, large in a heavy
 * gilt frame under a brass lamp in the middle of the museum wall; the others smaller, darker, hung crooked, red paint thrown across them;
 * under each a gilt plaque of gold coins, one per round won.
 */
function showPodium(sim: Sim, on: boolean): void {
  if (!on) { if (podium) podium.style.display = 'none'; podiumKey = ''; return; }
  const players = sim.fighters.filter((f) => f.controlled && !sim.gone[f.index]).map((f) => f.index);
  const ranked = [...players].sort((a, b) => (a === sim.matchWinner ? -1 : b === sim.matchWinner ? 1 : sim.scores[b] - sim.scores[a]));
  const key = JSON.stringify([ranked, ranked.map((i) => sim.scores[i]), ranked.map((i) => sim.looks[i])]);
  if (!podium) { podium = document.createElement('div'); podium.id = 'podium'; document.body.appendChild(podium); }
  podium.style.display = 'block';
  if (key === podiumKey) return;
  podiumKey = key;
  // Places left to right: 4th, 2nd, 1st (the middle column), 3rd.
  const col = [3, 2, 4, 1], tilt = [0, -7, 4, -3]; // (five columns, the fifth empty: the champion is in the middle of the screen)
  podium.innerHTML = `<div class="hang">${ranked.map((i, rank) => `<div class="hung r${rank}" style="grid-column:${col[rank]};--tilt:${tilt[rank]}deg">
      <div class="pic${rank === 0 ? ' lit' : ''}"><div class="lamp"></div><div class="frame"><div class="art"><canvas width="${PORTRAIT.w}" height="${PORTRAIT.h}"></canvas>${rank > 0 ? '<canvas class="splat" width="112" height="144"></canvas>' : ''}</div></div></div>
      <div class="coins">${'<i></i>'.repeat(Math.min(16, sim.scores[i]))}</div></div>`).join('')}</div>`; // (the menus' pictures: lit, the lamp is on)
  const frames = podium.querySelectorAll('.hung');
  ranked.forEach((i, rank) => {
    const canvas = frames[rank].querySelector('canvas')!, splat = frames[rank].querySelector<HTMLCanvasElement>('canvas.splat');
    void paintPortrait({ ...sim.looks[i] }, i, rank === 0 ? { crown: true } : {}).then((v) => { if (podiumKey === key) canvas.getContext('2d')!.drawImage(v[0], 0, 0); }); // (the others: the portraits the Hall painted)
    if (splat) redSplat(splat, rank);
  });
}
