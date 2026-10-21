const W = 1440;
const H = 4734;
const SPAN = 150;
const STILL = 60;

type Box = { x: number; y: number; w: number; h: number };
type Over = Record<string, unknown>;

const frac = (b: Box) => ({ x: (b.x + b.w / 2) / W, y: (b.y + b.h / 2) / H, width: b.w / W, height: b.h / H });
const fadeIn = (from: number) => ({ from, transitionIn: { kind: 'fade', durationInFrames: 12 } });

const rect = (id: string, b: Box, color: string, over: Over = {}) => ({ id, from: 0, durationInFrames: SPAN, component: 'Shape', props: { shape: 'rect', ...frac(b), fills: [{ type: 'solid', color }] }, ...over });
const label = (id: string, text: string, b: Box, px: number, color: string, over: Over = {}) => ({ id, from: 0, durationInFrames: SPAN, component: 'Text', props: { text, size: px / Math.min(W, H), ...frac(b), color, font: 'sans' }, ...over });
const group = (id: string, b: Box, over: Over = {}) => ({ id, from: 0, durationInFrames: SPAN, component: 'Null', props: { x: frac(b).x, y: frac(b).y }, ...over });
const row = (gap: number) => ({ autoLayout: { direction: 'horizontal', gap, padding: { top: 0, right: 0, bottom: 0, left: 0 }, justify: 'start', align: 'center' } });

const nav = [
  rect('nav', { x: 0, y: 0, w: W, h: 72 }, '#0e1220'),
  label('logo', 'Northwind', { x: 48, y: 20, w: 200, h: 32 }, 26, '#ffffff', { parent: 'nav' }),
  group('links', { x: 520, y: 24, w: 400, h: 24 }, { parent: 'nav', ...row(32) }),
  label('l1', 'Product', { x: 520, y: 24, w: 90, h: 24 }, 16, '#c9d1e6', { parent: 'links' }),
  label('l2', 'Pricing', { x: 640, y: 24, w: 90, h: 24 }, 16, '#c9d1e6', { parent: 'links' }),
  label('l3', 'Docs', { x: 760, y: 24, w: 90, h: 24 }, 16, '#c9d1e6', { parent: 'links' }),
  rect('cta', { x: 1236, y: 16, w: 156, h: 40 }, '#6d5cff', { parent: 'nav' }),
  label('cta-t', 'Start free', { x: 1256, y: 24, w: 116, h: 24 }, 16, '#ffffff', { parent: 'cta' })
];

const hero = [
  { id: 'glow', from: 0, durationInFrames: SPAN, component: 'Shape', props: { shape: 'ellipse', ...frac({ x: 420, y: 80, w: 600, h: 360 }), fills: [{ type: 'solid', color: '#6d5cff' }], opacity: 0.35 } },
  label('title', 'Ship faster together', { x: 220, y: 160, w: 1000, h: 90 }, 72, '#ffffff', fadeIn(6)),
  label('sub', 'The workspace for modern product teams', { x: 370, y: 260, w: 700, h: 32 }, 22, '#9aa3bd', fadeIn(12)),
  rect('b1', { x: 540, y: 320, w: 170, h: 52 }, '#6d5cff', fadeIn(18)),
  label('b1-t', 'Get started', { x: 560, y: 334, w: 130, h: 24 }, 17, '#ffffff', { parent: 'b1', ...fadeIn(18) }),
  rect('b2', { x: 730, y: 320, w: 170, h: 52 }, '#1c2236', fadeIn(20)),
  label('b2-t', 'Book a demo', { x: 750, y: 334, w: 130, h: 24 }, 17, '#ffffff', { parent: 'b2', ...fadeIn(20) })
];

const dash = [
  rect('card', { x: 220, y: 420, w: 1000, h: 400 }, '#151a2b', fadeIn(24)),
  rect('side', { x: 220, y: 420, w: 200, h: 400 }, '#1b2135', { parent: 'card' }),
  label('side-1', 'Overview', { x: 244, y: 450, w: 150, h: 22 }, 16, '#ffffff', { parent: 'side' }),
  label('side-2', 'Reports', { x: 244, y: 490, w: 150, h: 22 }, 16, '#8a93ad', { parent: 'side' }),
  group('chart', { x: 470, y: 520, w: 700, h: 260 }, { parent: 'card' }),
  ...[0.4, 0.65, 0.5, 0.85, 0.7, 0.95].map((v, i) => rect(`bar${i}`, { x: 490 + i * 110, y: 780 - 240 * v, w: 70, h: 240 * v }, '#2fbf71', { parent: 'chart', ...fadeIn(28 + i * 2) }))
];

const logos = [group('logos', { x: 220, y: 870, w: 1000, h: 40 }, row(60)), ...['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli'].map((n, i) => label(`logo-${i}`, n, { x: 220 + i * 200, y: 878, w: 160, h: 26 }, 20, '#5d6680', { parent: 'logos' }))];

const features = [0, 1, 2].flatMap((i) => {
  const x = 220 + i * 340;
  return [
    rect(`feat-${i}`, { x, y: 950, w: 320, h: 200 }, '#151a2b', fadeIn(40 + i * 3)),
    rect(`feat-${i}-icon`, { x: x + 24, y: 974, w: 40, h: 40 }, '#ff5a1f', { parent: `feat-${i}` }),
    label(`feat-${i}-t`, ['Realtime', 'Secure', 'Fast'][i], { x: x + 24, y: 1030, w: 270, h: 30 }, 24, '#ffffff', { parent: `feat-${i}` }),
    label(`feat-${i}-d`, 'Everything in sync, always', { x: x + 24, y: 1070, w: 270, h: 24 }, 15, '#8a93ad', { parent: `feat-${i}` })
  ];
});


export const landingDoc = {
  version: 5,
  fps: 30,
  width: W,
  height: H,
  durationInFrames: SPAN,
  still: { frame: STILL },
  tracks: [
    { id: 'ui', kind: 'visual', name: 'Page', clips: [rect('page', { x: 0, y: 0, w: W, h: H }, '#0a0d18'), ...nav, ...hero, ...dash, ...logos, ...features] }
  ],
  comps: {},
  assets: []
};
