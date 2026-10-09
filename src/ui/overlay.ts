// F3 debug overlay: FPS, frame time, sim cost, bodies, last impact, hidden HP, input.
const el = document.getElementById('overlay') as HTMLElement;
let on = import.meta.env.DEV; // (the live game hides it: it shows everyone's hidden health. F3 or the training panel's Debug numbers shows it)
el.style.display = on ? '' : 'none';

export function toggleOverlay(): void {
  on = !on;
  el.style.display = on ? '' : 'none';
}

export const isOverlayOn = (): boolean => on;

export function updateOverlay(lines: string[]): void {
  if (on) el.textContent = lines.join('\n');
}
