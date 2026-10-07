import { BOT_GRAYS, COLORS } from '../content/looks';
import { tuning as T } from '../content/tuning';
import { paintPortrait, PORTRAIT } from '../render/portrait';
import type { Sim } from '../sim/world';

// What is drawn over a real fight (2-4 players). Owner: as little text as possible. The scoreboard is each player's colour and their
// rounds won, with a pip for every round of the match; a round ends with a short banner ("Red wins!"); the match ends with the winner's
// bust, crowned, on the highest pedestal, the others lower, each pedestal marked with their rounds won. No words.
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
  const text = sim.roundOver && !sim.matchOver ? (sim.roundWinner >= 0 ? `${nameOf(sim, sim.roundWinner).name} wins!` : 'Draw!') : '';
  if (text !== lastBanner) { banner.textContent = text; banner.style.color = sim.roundWinner >= 0 ? hex(nameOf(sim, sim.roundWinner).hex) : '#fff'; lastBanner = text; }
  showPodium(sim, sim.matchOver);
}

/** Take the round's banner away (the museum slides on to the next painting: it belongs to the one before). */
export function clearBanner(): void { banner.textContent = ''; lastBanner = ''; }

/** The end of a match: busts on pedestals, the winner crowned in the middle and highest, under a warm light. */
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
  const col = [3, 2, 4, 1], H = [1, 0.68, 0.5, 0.36]; // (five columns, the fifth empty: the winner is in the middle of the screen)
  podium.innerHTML = `<div class="light"></div><div class="stand">${ranked.map((i, rank) => `<div class="place r${rank}" style="grid-column:${col[rank]}">
      <canvas width="${PORTRAIT.w}" height="${PORTRAIT.h}"></canvas>
      <div class="plinth" style="height:${H[rank] * 30}vh"><div class="marks">${'<i></i>'.repeat(Math.min(16, sim.scores[i]))}</div></div></div>`).join('')}</div>`;
  const canvases = podium.querySelectorAll('canvas');
  ranked.forEach((i, rank) => {
    const look = { ...sim.looks[i] };
    void paintPortrait(look, i, { bare: true, crown: rank === 0 }).then((v) => { if (podiumKey === key) canvases[rank].getContext('2d')!.drawImage(v[0], 0, 0); });
  });
}
