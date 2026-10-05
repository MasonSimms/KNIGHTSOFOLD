import { tuning as T } from '../content/tuning';
import type { Sim } from '../sim/world';

// The scoreboard and the round result, drawn as plain text over the game. Only shown in a real fight (2-4 players).
const score = document.getElementById('score') as HTMLElement;
const banner = document.getElementById('banner') as HTMLElement;
const NAMES = ['Red', 'Blue', 'Yellow', 'Green'];
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
let lastScore = '', lastBanner = '';

export function updateHud(sim: Sim): void {
  if (!sim.matchActive) {
    if (lastScore !== '') { score.innerHTML = ''; banner.textContent = ''; lastScore = lastBanner = ''; }
    return;
  }
  const players = sim.fighters.filter((f) => f.controlled && !sim.gone[f.index]); // (online: empty seats are not shown)
  const html = players.map((f) => `<span style="color:${hex(T.colors.players[f.index])}">${NAMES[f.index]} ${sim.scores[f.index]}</span>`).join(' &nbsp;&middot;&nbsp; ');
  if (html !== lastScore) { score.innerHTML = html; lastScore = html; }
  const text = sim.roundOver ? (sim.roundWinner >= 0 ? `${NAMES[sim.roundWinner]} wins the round!` : 'Draw!') : '';
  if (text !== lastBanner) { banner.textContent = text; banner.style.color = sim.roundWinner >= 0 ? hex(T.colors.players[sim.roundWinner]) : '#fff'; lastBanner = text; }
}
