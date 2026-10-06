import { BOT_GRAYS, COLORS } from '../content/looks';
import type { Sim } from '../sim/world';

// The scoreboard and the round result, drawn as plain text over the game. Only shown in a real fight (2-4 players).
const score = document.getElementById('score') as HTMLElement;
const banner = document.getElementById('banner') as HTMLElement;
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
let lastScore = '', lastBanner = '';

export function updateHud(sim: Sim): void {
  if (!sim.matchActive) {
    if (lastScore !== '') { score.innerHTML = ''; banner.textContent = ''; lastScore = lastBanner = ''; }
    return;
  }
  const players = sim.fighters.filter((f) => f.controlled && !sim.gone[f.index]); // (online: empty seats are not shown)
  const col = (i: number) => (sim.looks[i]?.bot ? { name: 'Bot ' + (1 + sim.looks.slice(0, i).filter((l) => l.bot).length), hex: BOT_GRAYS[i % BOT_GRAYS.length] } : COLORS[sim.looks[i]?.color ?? i]);
  const html = players.map((f) => `<span style="color:${hex(col(f.index).hex)}">${col(f.index).name} ${sim.scores[f.index]}</span>`).join(' &nbsp;&middot;&nbsp; ');
  if (html !== lastScore) { score.innerHTML = html; lastScore = html; }
  const text = sim.roundOver ? (sim.roundWinner >= 0 ? `${col(sim.roundWinner).name} wins the round!` : 'Draw!') : '';
  if (text !== lastBanner) { banner.textContent = text; banner.style.color = sim.roundWinner >= 0 ? hex(col(sim.roundWinner).hex) : '#fff'; lastBanner = text; }
}
