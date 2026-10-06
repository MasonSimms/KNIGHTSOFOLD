// F3 debug overlay: FPS, frame time, sim cost, bodies, last impact, hidden HP, input.
const el = document.getElementById('overlay') as HTMLElement;
let on = true;

export function toggleOverlay(): void {
  on = !on;
  el.style.display = on ? '' : 'none';
}

export const isOverlayOn = (): boolean => on;

export function updateOverlay(lines: string[]): void {
  if (on) el.textContent = lines.join('\n');
}
