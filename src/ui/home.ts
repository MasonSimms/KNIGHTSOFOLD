import { menuPresses } from '../input/input';
import { closeMenu, hangPicture, openMenu } from './menu';

// The home screen: a gallery of five painted arenas. Play (centre) opens the Hall of Champions, Online the room screen, Training a
// practice round with the dummy. The two lower side pictures are decoration for now (later: settings, an era gallery).
export type HomeChoice = 'play' | 'online' | 'training';

const PICS: { era: string; go?: HomeChoice; label?: string; sub?: string; cell: string; w: number; h: number }[] = [
  { era: 'vikings', go: 'online', label: 'Online', cell: '1 / 1', w: 400, h: 225 },
  { era: 'pirates', cell: '2 / 1', w: 400, h: 225 },
  { era: 'medieval', go: 'play', label: 'Play', sub: 'Choose your knights and take the field', cell: '1 / 2 / span 2', w: 960, h: 540 },
  { era: 'samurai', go: 'training', label: 'Training', cell: '1 / 3', w: 400, h: 225 },
  { era: 'mobsters', cell: '2 / 3', w: 400, h: 225 },
];

export function runHome(): Promise<HomeChoice> {
  const html = PICS.map((p) => `<div class="pic ${p.go ? 'go' : 'deco'} ${p.go === 'play' ? 'main' : 'side'}" style="grid-area:${p.cell}"${p.go ? ` data-go="${p.go}"` : ''}>
    <div class="lamp"></div><div class="frame"><div class="art"><canvas></canvas></div></div>
    ${p.label ? `<div class="label">${p.label}</div>` : ''}${p.sub ? `<div class="sub">${p.sub}</div>` : ''}</div>`).join('');
  const root = openMenu('gallery', html);
  root.querySelectorAll('canvas').forEach((c, i) => hangPicture(c, PICS[i].era, PICS[i].w, PICS[i].h));
  const go = [...root.querySelectorAll<HTMLElement>('[data-go]')]; // online, play, training: left to right
  let focus = -1, raf = 0; // every lamp is off until you point at a picture (owner); a key or the gamepad starts on Play
  const light = () => go.forEach((el, i) => el.classList.toggle('lit', i === focus));
  light();
  menuPresses(); // (buttons already held when the screen opens are not presses)

  return new Promise((resolve) => {
    const pick = (el: HTMLElement) => { cancelAnimationFrame(raf); removeEventListener('keydown', onKey); closeMenu(); resolve(el.dataset.go as HomeChoice); };
    const move = (d: number) => { focus = focus < 0 ? 1 : Math.max(0, Math.min(go.length - 1, focus + d)); light(); };
    go.forEach((el, i) => { el.onmouseenter = () => { focus = i; light(); }; el.onmouseleave = () => { focus = -1; light(); }; el.onclick = () => pick(el); });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') move(-1);
      else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') move(1);
      else if (e.code === 'Enter' || e.code === 'Space') pick(go[Math.max(0, focus < 0 ? 1 : focus)]);
    };
    addEventListener('keydown', onKey);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      for (const p of menuPresses()) {
        if (p.b === 'left' || p.b === 'up') move(-1);
        else if (p.b === 'right' || p.b === 'down') move(1);
        else if (p.b === 'a' || p.b === 'start') return pick(go[focus < 0 ? 1 : focus]);
      }
    };
    tick();
  });
}
