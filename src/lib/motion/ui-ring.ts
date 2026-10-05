import { TrackKind } from './components';
import { Ease, TransitionKind } from './design';
import { MotionFormat, parseMotionDoc, type MotionComp, type MotionDoc } from './doc';
import { CardKind, Spin, type RingCard } from './ring/model';
import { FillKind, ShapeKind, StrokeKind, modifierKey } from './shape/schema';
import { ModifierKind } from './shape/modifiers';
import { assemble, edge, s, type Beat, type TrackSpec } from './template-kit';

export const UI_RING_SECONDS = 16;
const CARD_SECONDS = 8;
const OUTRO = 0.5;

const INK = '#0a0a0a';
const SOFT = '#8a8a8a';
const RULE = '#dcdad4';
const ACCENT = 'brand.accent';
const STAGE = '#0a0a0a';
const CARD = '#f0eee9';

const TRACKS: TrackSpec[] = [
  { id: 'text', kind: TrackKind.Visual, name: 'Text' },
  { id: 'chart', kind: TrackKind.Visual, name: 'Chart' },
  { id: 'grid', kind: TrackKind.Visual, name: 'Grid' }
];

const DRAW = 'draw';
const drawn = (end: number, seconds: number, delay = 0.3): Pick<Beat, 'keys'> & { modifiers: unknown[] } => ({
  modifiers: [{ id: DRAW, kind: ModifierKind.Trim, enabled: true, params: { start: 0, end: 1, offset: 0 } }],
  keys: { [modifierKey(DRAW, 'end')]: [[delay, 0], [delay + seconds, end, Ease.Standard], [CARD_SECONDS - OUTRO, end], [CARD_SECONDS, 0, Ease.Exit]] }
});

const label = (id: string, text: string): Beat => ({ id: `${id}-label`, track: 'text', component: 'Kicker', at: 0, len: CARD_SECONDS, props: { text, x: 0.35, y: 0.16, width: 0.6, align: 'left', size: 0.06, color: SOFT } });

const figure = (id: string, text: string): Beat => ({ id: `${id}-figure`, track: 'text', component: 'Title', at: 0.2, len: CARD_SECONDS - 0.2, props: { text, x: 0.35, y: 0.33, width: 0.6, height: 0.24, align: 'left', size: 0.2, color: INK }, exit: edge(TransitionKind.Fade, OUTRO) });

const rules = (id: string): Beat[] =>
  [0.55, 0.68, 0.81, 0.94].map((y, i) => ({ id: `${id}-rule${i}`, track: 'grid', component: 'Shape', at: 0, len: CARD_SECONDS, props: { shape: ShapeKind.Line, y, width: 0.86, height: 0.004, fill: RULE } }));

const stroke = (id: string, path: string, box: { x: number; y: number; width: number; height: number }, color: string, delay: number): Beat => {
  const { modifiers, keys } = drawn(1, 1.6, delay);
  return { id, track: 'chart', component: 'Shape', at: 0, len: CARD_SECONDS, props: { shape: ShapeKind.Path, path, ...box, fillKind: FillKind.None, strokeKind: StrokeKind.Solid, stroke: color, strokeWidth: 0.012, cap: 'round', join: 'round', modifiers }, keys };
};

const customers = (id: string): Beat[] => [
  label(id, 'Active customers'),
  figure(id, '1,845'),
  ...rules(id),
  stroke(`${id}-wave`, 'M0 0.85 C0.12 0.85 0.18 0.3 0.32 0.35 S0.55 0.95 0.7 0.6 S0.88 0.05 1 0.05', { x: 0.5, y: 0.74, width: 0.86, height: 0.4 }, ACCENT, 0.4)
];

const revenue = (id: string): Beat[] => [
  label(id, 'Revenue'),
  figure(id, '$34,021'),
  ...[0.45, 0.62, 0.52, 0.8, 0.95].map(
    (h, i): Beat => ({
      id: `${id}-bar${i}`,
      track: 'chart',
      component: 'Shape',
      at: 0,
      len: CARD_SECONDS,
      props: { shape: ShapeKind.Rect, x: 0.18 + i * 0.16, y: 0.95 - (h * 0.42) / 2, width: 0.11, height: h * 0.42, fill: i === 4 ? ACCENT : '#9fc9f0' },
      transform: { anchorY: 1 },
      keys: { scaleY: [[0.3 + i * 0.12, 0], [0.9 + i * 0.12, 1, Ease.Overshoot], [CARD_SECONDS - OUTRO, 1], [CARD_SECONDS, 0, Ease.Exit]] }
    })
  )
];

const retention = (id: string): Beat[] => {
  const { modifiers, keys } = drawn(0.82, 1.4);
  return [
    label(id, 'Retention'),
    figure(id, '82%'),
    { id: `${id}-track`, track: 'grid', component: 'Shape', at: 0, len: CARD_SECONDS, props: { shape: ShapeKind.Circle, x: 0.72, y: 0.7, width: 0.2, height: 0.36, fillKind: FillKind.None, strokeKind: StrokeKind.Solid, stroke: RULE, strokeWidth: 0.04 } },
    { id: `${id}-arc`, track: 'chart', component: 'Shape', at: 0, len: CARD_SECONDS, props: { shape: ShapeKind.Circle, x: 0.72, y: 0.7, width: 0.2, height: 0.36, fillKind: FillKind.None, strokeKind: StrokeKind.Solid, stroke: ACCENT, strokeWidth: 0.04, modifiers }, keys }
  ];
};

const reach = (id: string): Beat[] => [
  label(id, 'Weekly reach'),
  figure(id, '128k'),
  ...rules(id),
  stroke(`${id}-a`, 'M0 0.9 L0.25 0.7 L0.5 0.75 L0.75 0.35 L1 0.2', { x: 0.5, y: 0.74, width: 0.86, height: 0.4 }, ACCENT, 0.3),
  stroke(`${id}-b`, 'M0 0.95 L0.25 0.85 L0.5 0.6 L0.75 0.65 L1 0.45', { x: 0.5, y: 0.74, width: 0.86, height: 0.4 }, INK, 0.6),
  stroke(`${id}-c`, 'M0 1 L0.25 0.95 L0.5 0.9 L0.75 0.8 L1 0.7', { x: 0.5, y: 0.74, width: 0.86, height: 0.4 }, SOFT, 0.9)
];

const CARDS: [id: string, name: string, beats: (id: string) => Beat[]][] = [
  ['customers', 'Active customers', customers],
  ['revenue', 'Revenue', revenue],
  ['retention', 'Retention', retention],
  ['reach', 'Weekly reach', reach]
];

export const DASHBOARD_CARD_COUNT = CARDS.length;

function card(id: string, name: string, beats: Beat[]): MotionComp {
  const doc = assemble({ format: MotionFormat.Landscape, seconds: CARD_SECONDS, tracks: TRACKS, beats });
  return { name, durationInFrames: s(CARD_SECONDS), tracks: doc.tracks.map((t) => ({ ...t, id: `${id}-${t.id}` })) };
}

export function dashboardCards(prefix = ''): { comps: Record<string, MotionComp>; cards: RingCard[] } {
  const ids = CARDS.map(([id, name, beats]) => [`${prefix}${id}`, name, beats] as const);
  return {
    comps: Object.fromEntries(ids.map(([id, name, beats]) => [id, card(id, name, beats(id))])),
    cards: ids.map(([id]) => ({ kind: CardKind.Comp, ref: id }))
  };
}

export function uiRing(): MotionDoc {
  const shell = assemble({
    format: MotionFormat.Landscape,
    seconds: UI_RING_SECONDS,
    tracks: [
      { id: 'ring', kind: TrackKind.Visual, name: 'Ring' },
      { id: 'bg', kind: TrackKind.Visual, name: 'Background' }
    ],
    beats: [
      { id: 'bg', track: 'bg', component: 'BrandBackground', at: 0, len: UI_RING_SECONDS, props: { fill: STAGE, pattern: 'gradient', accent: ACCENT } },
      {
        id: 'ui-ring',
        track: 'ring',
        component: 'Ring',
        at: 0,
        len: UI_RING_SECONDS,
        props: { count: 6, ringRadius: 0.56, cardHeight: 0.32, gap: 0.03, tiltX: -16, tiltZ: -18, loop: UI_RING_SECONDS, turns: 1, direction: Spin.Left, backOpacity: 0.35, backBlur: 2, shadowOpacity: 0.45, cardColor: CARD, cameraDistance: 1900, cameraHeight: 0.12 },
        keys: { tiltX: [[0, -16], [UI_RING_SECONDS / 2, -9, Ease.Standard], [UI_RING_SECONDS, -16, Ease.Standard]] }
      }
    ]
  });
  const { comps, cards } = dashboardCards();
  const verdict = parseMotionDoc({
    ...shell,
    comps,
    tracks: shell.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.component === 'Ring' ? { ...c, props: { ...c.props, cards } } : c)) }))
  });
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}
