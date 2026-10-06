import { BOT_GRAYS, COLORS } from '../content/looks';
import { tuning as T } from '../content/tuning';
import type { Sim } from '../sim/world';

// The scoreboard (with the round of the match), the round result, and the crown at the end of a match, drawn as plain text over the
// game. Only shown in a real fight (2-4 players).
const score = document.getElementById('score') as HTMLElement;
const banner = document.getElementById('banner') as HTMLElement;
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
let lastScore = '', lastBanner = '', lastCrown = '', crown: HTMLElement | null = null;

/** A player's name and colour as the scoreboard shows them (a bot: Bot 1, 2... in shades of gray). */
const nameOf = (sim: Sim, i: number) => (sim.looks[i]?.bot ? { name: 'Bot ' + (1 + sim.looks.slice(0, i).filter((l) => l.bot).length), hex: BOT_GRAYS[i % BOT_GRAYS.length] } : COLORS[sim.looks[i]?.color ?? i]);

export function updateHud(sim: Sim): void {
  if (!sim.matchActive) {
    if (lastScore !== '') { score.innerHTML = ''; banner.textContent = ''; lastScore = lastBanner = ''; }
    showCrown('');
    return;
  }
  const players = sim.fighters.filter((f) => f.controlled && !sim.gone[f.index]); // (online: empty seats are not shown)
  const round = `<span class="round">${sim.tieBreak ? 'Tie-break' : `Round ${Math.min(sim.round, T.match.rounds)} of ${T.match.rounds}`}</span>`;
  const html = round + ' &nbsp;&middot;&nbsp; ' + players.map((f) => `<span style="color:${hex(nameOf(sim, f.index).hex)}">${nameOf(sim, f.index).name} ${sim.scores[f.index]}</span>`).join(' &nbsp;&middot;&nbsp; ');
  if (html !== lastScore) { score.innerHTML = html; lastScore = html; }
  const text = sim.roundOver && !sim.matchOver ? (sim.roundWinner >= 0 ? `${nameOf(sim, sim.roundWinner).name} wins the round!` : 'Draw!') : '';
  if (text !== lastBanner) { banner.textContent = text; banner.style.color = sim.roundWinner >= 0 ? hex(nameOf(sim, sim.roundWinner).hex) : '#fff'; lastBanner = text; }
  if (!sim.matchOver) return showCrown('');
  // The crown: the winner in their colour, then everyone by score.
  const w = nameOf(sim, sim.matchWinner), ranked = [...players].sort((a, b) => sim.scores[b.index] - sim.scores[a.index]);
  showCrown(`<div class="crest">&#9819;</div><div class="who" style="color:${hex(w.hex)}">${w.name}</div><div class="takes">takes the crown</div>
    <ol>${ranked.map((f) => `<li><span style="color:${hex(nameOf(sim, f.index).hex)}">${nameOf(sim, f.index).name}</span><b>${sim.scores[f.index]}</b></li>`).join('')}</ol>
    <div class="next">Back to the Hall in a moment</div>`);
}

function showCrown(html: string): void {
  if (html === lastCrown) return;
  lastCrown = html;
  if (!crown) { crown = document.createElement('div'); crown.id = 'crown'; document.body.appendChild(crown); }
  crown.innerHTML = html;
  crown.style.display = html ? 'block' : 'none';
}
