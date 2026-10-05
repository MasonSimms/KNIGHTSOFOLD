// How each era's backdrop is painted (art direction: art-guide/ART_STYLE.md). Pure data: the painter (src/render/painter/) composes a simple
// scene from it (sky, glow, clouds, far hills, a building or landmark, masses at the sides, a hot-colour pennant, misty void) plus the round's
// real platforms and walls, then paints it with oil strokes. Muted world, ONE hot accent per era. Cavemen, gladiators (antiquity), WW1
// (gunpowder), modern and space age come from the art package's own era settings; the rest follow the same rules.
// `brush` changes the painting style a little per era: size = stroke size, jitter = colour wobble, relief = paint thickness, bristle = streakiness.

export type Mid = 'cave' | 'pyramid' | 'temple' | 'longhall' | 'castle' | 'pagoda' | 'ship' | 'mesa' | 'fort' | 'huts' | 'ruins' | 'station' | 'skyline';

export interface Painting {
  sky: [string, string, string]; // top, middle, horizon
  glow: { x: number; y: number; amt: [number, number, number] }; // sun/fire glow (design px, 1920x1080) and how much it adds
  clouds: [string, string, string];
  hills: [string, string]; // far, near
  mid: Mid;
  side: [string, string, string, string, string, string]; // the masses at both sides, darkest to lightest
  blocky?: boolean; // side masses are blocks (city, space) instead of round foliage
  trunk?: string;
  plat: { lip: string; lipdark: string; face: string; dark: string; seam: string };
  void: [string, string];
  mist: string;
  hot: string; // the one hot accent: pennant (and capes)
  extra?: ('stars' | 'planet' | 'rain' | 'smoke' | 'sea' | 'snow')[];
  brush?: { size?: number; jitter?: number; relief?: number; bristle?: number };
}

const P: Record<string, Painting> = {
  caveman: { sky: ['#8E7A5A', '#D9A55E', '#F3D68A'], glow: { x: 520, y: 620, amt: [0.55, 0.28, 0.06] }, clouds: ['#F3DDB0', '#C99A5A', '#7A5A3A'], hills: ['#A27E58', '#7E5C3C'], mid: 'cave',
    side: ['#3A2C20', '#5A4430', '#7E6040', '#A0805A', '#C9A672', '#E3C48C'], plat: { lip: '#C9B070', lipdark: '#8F7A44', face: '#8A6C48', dark: '#4A3A2C', seam: '#5A4630' },
    void: ['#4A3A2C', '#1E1610'], mist: '#A07850', hot: '#D8541F', brush: { size: 1.1, jitter: 1.3, relief: 1.2 } },
  egypt: { sky: ['#7FA6B8', '#E6CF9A', '#F6E2A8'], glow: { x: 1380, y: 560, amt: [0.4, 0.3, 0.1] }, clouds: ['#FFF4DC', '#EAD2A4', '#A88A62'], hills: ['#D9B57A', '#C29A5E'], mid: 'pyramid',
    side: ['#5A4026', '#7A5A34', '#9C7A48', '#BE9A62', '#D9BC84', '#EEDAA8'], trunk: '#5A4428', plat: { lip: '#E8D2A0', lipdark: '#B89A64', face: '#C9A872', dark: '#7A6040', seam: '#9A7E52' },
    void: ['#6A5030', '#1E140A'], mist: '#C8A878', hot: '#C23A2C' },
  gladiators: { sky: ['#6C98B0', '#B7D0D6', '#F4EAD0'], glow: { x: 1400, y: 500, amt: [0.3, 0.26, 0.12] }, clouds: ['#FFFFFF', '#DCE8EA', '#7FA0B0'], hills: ['#8BA7A0', '#6F8A6A'], mid: 'temple',
    side: ['#2F3C2B', '#4B5C3A', '#6F8350', '#93A86A', '#B8C68C', '#D8E0B0'], trunk: '#3A3326', plat: { lip: '#EDE7D5', lipdark: '#C8C0A8', face: '#D9D2BE', dark: '#9A937F', seam: '#B0A98F' },
    void: ['#5A7A8A', '#1F2F3A'], mist: '#A8C4CC', hot: '#C23A2C' },
  vikings: { sky: ['#5E7A8C', '#A9BCC4', '#DCE4E2'], glow: { x: 1300, y: 520, amt: [0.16, 0.16, 0.14] }, clouds: ['#EEF2F2', '#B4C2C8', '#56687A'], hills: ['#8C9CA8', '#6A7C88'], mid: 'longhall',
    side: ['#1E2A26', '#2E3E36', '#44564A', '#627668', '#8A9C90', '#C2CEC8'], trunk: '#2A241E', plat: { lip: '#D8E0E2', lipdark: '#A8B4B8', face: '#6E6A62', dark: '#3A3834', seam: '#4E4A44' },
    void: ['#3A4A56', '#10161C'], mist: '#9AAAB4', hot: '#C8402A', extra: ['snow'], brush: { jitter: 0.8 } },
  medieval: { sky: ['#7C9692', '#C4BE98', '#F0D6A0'], glow: { x: 1380, y: 560, amt: [0.35, 0.24, 0.08] }, clouds: ['#F1E4C0', '#CDD3C0', '#5F7C80'], hills: ['#93A284', '#73866A'], mid: 'castle',
    side: ['#2F3F27', '#44582F', '#5E7440', '#7E9654', '#A7B66A', '#C9C47E'], trunk: '#2B3222', plat: { lip: '#8DA648', lipdark: '#4F6B2D', face: '#8A8C80', dark: '#4A4D47', seam: '#4F524C' },
    void: ['#3A4A3F', '#161A14'], mist: '#7C8C74', hot: '#D04A2C' },
  samurai: { sky: ['#8A7090', '#D8B0B0', '#F4D8C0'], glow: { x: 1300, y: 520, amt: [0.4, 0.18, 0.12] }, clouds: ['#F6E6E0', '#D0A8B4', '#6A5070'], hills: ['#A88CA0', '#806878'], mid: 'pagoda',
    side: ['#3A2A34', '#5A3E4E', '#8A5A70', '#C482A0', '#E4AEC4', '#F6D6E2'], trunk: '#3A2A26', plat: { lip: '#B88A5A', lipdark: '#7A5434', face: '#6B4A3A', dark: '#3A2620', seam: '#4E3426' },
    void: ['#4A3446', '#160E16'], mist: '#B898B0', hot: '#C8282C', brush: { size: 1.25, jitter: 0.6, relief: 0.6, bristle: 0.6 } }, // ink-wash soft
  pirates: { sky: ['#5E8EA8', '#A8CCD4', '#EAF0E0'], glow: { x: 1400, y: 560, amt: [0.3, 0.26, 0.14] }, clouds: ['#FFFFFF', '#D8E6EA', '#6E8C9C'], hills: ['#7E9EA4', '#5E7E86'], mid: 'ship',
    side: ['#22302E', '#36484A', '#4E6464', '#6E8684', '#94AAA4', '#C4D2CA'], plat: { lip: '#A67A4A', lipdark: '#6E4C2C', face: '#5E4028', dark: '#2E1E12', seam: '#3E2A1A' },
    void: ['#24505E', '#0A1A22'], mist: '#8AB4BC', hot: '#C8282C', extra: ['sea'] },
  westerns: { sky: ['#7EA0B8', '#E8C08A', '#F6D890'], glow: { x: 520, y: 640, amt: [0.5, 0.28, 0.08] }, clouds: ['#F8E4C0', '#E0A878', '#8A5A48'], hills: ['#C08060', '#9A6048'], mid: 'mesa',
    side: ['#3A2418', '#5E3A24', '#8A5634', '#B0764A', '#D09A66', '#E8C08C'], plat: { lip: '#C8A070', lipdark: '#8A6440', face: '#8A6240', dark: '#4A3020', seam: '#5A3C26' },
    void: ['#5A3420', '#1A0E08'], mist: '#C89070', hot: '#B83A24', brush: { jitter: 1.15 } },
  ww1: { sky: ['#6F6B66', '#A79F90', '#E0B070'], glow: { x: 600, y: 720, amt: [0.55, 0.28, 0.06] }, clouds: ['#CFC6B4', '#8E877C', '#4A4642'], hills: ['#7A7468', '#585349'], mid: 'fort',
    side: ['#2E2C2C', '#4E4B49', '#6E6A65', '#948D82', '#BDB3A0', '#DDD2BC'], plat: { lip: '#7A6A4A', lipdark: '#4E422E', face: '#5E5040', dark: '#2E261C', seam: '#3E3428' },
    void: ['#4A4642', '#171514'], mist: '#9A9286', hot: '#B02A30', extra: ['smoke'], brush: { jitter: 1.2, relief: 1.1 } },
  vietnam: { sky: ['#7E9A88', '#C8D0A8', '#EEE2B0'], glow: { x: 1300, y: 600, amt: [0.3, 0.26, 0.1] }, clouds: ['#F4F0D8', '#C8D0B0', '#6A7E68'], hills: ['#6E8A60', '#4E6A44'], mid: 'huts',
    side: ['#14241A', '#22382A', '#34503A', '#4E6E48', '#78965E', '#A8BE7E'], trunk: '#2A2A1E', plat: { lip: '#8EA048', lipdark: '#5A6A2C', face: '#6A5A3C', dark: '#34281A', seam: '#4A3C28' },
    void: ['#2E3E2C', '#0C140C'], mist: '#9AAE8C', hot: '#D8402A' },
  modern: { sky: ['#6F7C84', '#9AA5A8', '#C6CDCD'], glow: { x: 900, y: 400, amt: [0.18, 0.19, 0.18] }, clouds: ['#D5DBDB', '#8D979B', '#4E5A62'], hills: ['#7E8A8E', '#5E6A70'], mid: 'ruins',
    side: ['#22282D', '#3C444B', '#58626A', '#7C878F', '#A7B0B6', '#C9D0D4'], blocky: true, plat: { lip: '#9FA29A', lipdark: '#6E726C', face: '#80858A', dark: '#3F4448', seam: '#5A5F64' },
    void: ['#3A4448', '#111517'], mist: '#8E9A9E', hot: '#E2661E', extra: ['rain'] },
  scifi: { sky: ['#0F0A33', '#2A1F6E', '#6A48A8'], glow: { x: 1500, y: 380, amt: [0.32, 0.1, 0.28] }, clouds: ['#E04BB0', '#3DE0E8', '#5A4B9A'], hills: ['#3A3280', '#2A2468'], mid: 'station',
    side: ['#14123A', '#241F5E', '#3A3482', '#5C52B0', '#8C80DC', '#C2B8F6'], blocky: true, plat: { lip: '#3DE0E8', lipdark: '#1AA0B0', face: '#4A4A7A', dark: '#1E1B4B', seam: '#2E2C66' },
    void: ['#241A5A', '#07041A'], mist: '#7A58C8', hot: '#E04BB0', extra: ['stars', 'planet'], brush: { jitter: 0.8, relief: 0.8 } },
  fantasy: { sky: ['#4E6A9A', '#A8B8D8', '#F0E0C8'], glow: { x: 1380, y: 520, amt: [0.4, 0.32, 0.12] }, clouds: ['#FFF6E0', '#C8D0E8', '#5A6A9A'], hills: ['#7A90A8', '#5A7088'], mid: 'castle',
    side: ['#1E2A3A', '#2E4050', '#465E6A', '#647E84', '#8EA8A4', '#C0D2C4'], trunk: '#2A2A30', plat: { lip: '#7EA05A', lipdark: '#4A6A36', face: '#7A7C8A', dark: '#3E404C', seam: '#4E5060' },
    void: ['#2A3450', '#0C1020'], mist: '#8A9AC0', hot: '#D8402A', brush: { size: 1.1 } },
  mobsters: { sky: ['#1E1E30', '#3A3450', '#8A6A70'], glow: { x: 1300, y: 640, amt: [0.4, 0.26, 0.08] }, clouds: ['#6A5A6A', '#4A3E52', '#24202E'], hills: ['#3A3448', '#2A2438'], mid: 'skyline',
    side: ['#1A1418', '#2E2228', '#463438', '#62484C', '#8A6A68', '#B89890'], blocky: true, plat: { lip: '#7A7270', lipdark: '#4A4444', face: '#5A4A44', dark: '#2A2220', seam: '#3A2E2A' },
    void: ['#2A2430', '#0A080E'], mist: '#5A4E60', hot: '#C8202C', extra: ['rain'], brush: { jitter: 0.9 } },
};

export const paintingFor = (eraId: string): Painting => P[eraId] ?? P.medieval;
