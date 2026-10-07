import { TrackKind } from './components';
import { Ease, TransitionKind } from './design';
import { MotionFormat, type MotionDoc } from './doc';
import { MaskKind } from './mask';
import { FADE_OUT, RISE, assemble, edge, type Beat, type Key, type TrackSpec } from './template-kit';
import type { TemplateAssets } from './ad-templates';

type Box = { x: number; y: number; width: number; height: number };
type Layout = { text: { x: number; width: number; kickerY: number; titleY: number; titleHeight: number; size: number }; stage: Box; hook: Box & { size: number }; end: number };

const LAYOUTS: Partial<Record<MotionFormat, Layout>> = {
  [MotionFormat.Landscape]: {
    text: { x: 0.3, width: 0.5, kickerY: 0.26, titleY: 0.5, titleHeight: 0.4, size: 0.15 },
    stage: { x: 0.73, y: 0.5, width: 0.46, height: 0.78 },
    hook: { x: 0.33, y: 0.45, width: 0.56, height: 0.62, size: 0.19 },
    end: 0.2
  },
  [MotionFormat.Vertical]: {
    text: { x: 0.5, width: 0.88, kickerY: 0.09, titleY: 0.22, titleHeight: 0.2, size: 0.16 },
    stage: { x: 0.5, y: 0.66, width: 0.9, height: 0.5 },
    hook: { x: 0.5, y: 0.42, width: 0.88, height: 0.4, size: 0.2 },
    end: 0.2
  }
};

const SECONDS = 28;
const INK = '#111111';
const PAPER = '#ffffff';
const SOFT = '#6b6b6b';
const LIGHT = '#f5f5f3';
const BEAT = 0.5;

const TRACKS: TrackSpec[] = [
  { id: 'ui', kind: TrackKind.Visual, name: 'UI' },
  { id: 'text', kind: TrackKind.Visual, name: 'Text' },
  { id: 'media', kind: TrackKind.Visual, name: 'Media' },
  { id: 'bg', kind: TrackKind.Visual, name: 'Background' },
  { id: 'music', kind: TrackKind.Audio, name: 'Music' },
  { id: 'vo', kind: TrackKind.Audio, name: 'Voice-over' }
];

const inside = (stage: Box, rx: number, ry: number, rw: number, rh: number) => ({
  x: stage.x + (rx - 0.5) * stage.width,
  y: stage.y + (ry - 0.5) * stage.height,
  width: rw * stage.width,
  height: rh * stage.height
});

function chapter(l: Layout, i: number, kicker: string, title: string, at: number, len: number, extra: Partial<Beat> = {}): Beat[] {
  return [
    { id: `kicker-${i}`, track: 'text', component: 'Kicker', at, len, props: { text: kicker, x: l.text.x, y: l.text.kickerY, width: l.text.width, align: 'left', size: 0.03 }, enter: RISE, exit: FADE_OUT },
    { id: `title-${i}`, track: 'text', component: 'Title', at: at + 0.1, len: len - 0.1, props: { text: title, x: l.text.x, y: l.text.titleY, width: l.text.width, height: l.text.titleHeight, align: 'left', size: l.text.size }, exit: FADE_OUT, ...extra }
  ];
}

function hook(l: Layout): Beat[] {
  return [
    { id: 'hook-kicker', track: 'text', component: 'Kicker', at: 0.2, len: 3.3, props: { text: '( feega )', x: l.hook.x, y: l.hook.y - l.hook.height / 2 - 0.04, width: l.hook.width, align: 'left', size: 0.03 }, enter: RISE, exit: FADE_OUT },
    { id: 'hook', track: 'text', component: 'Title', at: 0.3, len: 3.2, props: { text: 'Better\nmarketing\non canvas.', ...l.hook, align: 'left' }, exit: FADE_OUT },
    { id: 'hook-rule', track: 'text', component: 'Shape', at: 1.2, len: 2.3, props: { shape: 'line', x: 0.5, y: l.hook.y + l.hook.height / 2 + 0.05, width: 0.9, height: 0.002 }, exit: FADE_OUT },
    { id: 'hook-sub', track: 'text', component: 'Text', at: 1.5, len: 2, props: { text: 'The AI creative workspace for creators and brands.', x: l.hook.x, y: l.hook.y + l.hook.height / 2 + 0.1, width: l.hook.width, height: 0.06, align: 'left', size: 0.032, color: 'brand.secondary' }, exit: FADE_OUT }
  ];
}

function generate(l: Layout, a: TemplateAssets): Beat[] {
  return [
    ...chapter(l, 1, '( 01 ) Generate', 'Text to\nimage to\nvideo.', 3.6, 4.4),
    { id: 'canvas', track: 'media', component: 'CanvasMock', at: 3.7, len: 4.3, props: { ...inside(l.stage, 0.5, 0.5, 1, 0.82), title: 'Spring drop', prompt: 'White runner floating over a concrete plinth, orange sun, soft studio light.', assetId: a.imageId }, enter: edge(TransitionKind.SlideUp, 0.45), exit: FADE_OUT }
  ];
}

function sound(l: Layout, a: TemplateAssets): Beat[] {
  const bars = 18;
  const card = inside(l.stage, 0.5, 0.5, 1, 0.56);
  const bar = (i: number): Beat => {
    const heights: Key[] = Array.from({ length: 9 }, (_, k) => [k * BEAT, 0.25 + 0.75 * Math.abs(Math.sin(i * 0.9 + k * 1.7)), Ease.Standard] as Key);
    return {
      id: `bar-${i}`,
      track: 'ui',
      component: 'Shape',
      at: 8.2 + i * 0.02,
      len: 3.8 - i * 0.02,
      props: { shape: 'rect', fill: 'brand.accent', ...inside(card, 0.08 + (0.84 * i) / (bars - 1), 0.52, 0, 0.42), width: 0.02 },
      keys: { scaleY: heights },
      transform: { scaleX: 0.5 },
      exit: FADE_OUT
    };
  };
  return [
    ...chapter(l, 2, '( 02 ) Sound', 'Voice and\nmusic,\nbuilt in.', 8, 4),
    { id: 'audio-card', track: 'media', component: 'Shape', at: 8.05, len: 3.95, props: { shape: 'rect', fill: PAPER, ...card }, enter: edge(TransitionKind.SlideUp, 0.4), exit: FADE_OUT },
    { id: 'audio-label', track: 'ui', component: 'Kicker', at: 8.2, len: 3.8, props: { text: 'Audio · Music', ...inside(card, 0.5, 0.12, 0.88, 0.12), align: 'left', size: 0.022, color: INK }, exit: FADE_OUT },
    ...Array.from({ length: bars }, (_, i) => bar(i)),
    { id: 'audio-meta', track: 'ui', component: 'Kicker', at: 8.4, len: 3.6, props: { text: 'music_v1 · 30 s · 120 bpm', ...inside(card, 0.5, 0.9, 0.88, 0.1), align: 'left', size: 0.02, color: SOFT }, exit: FADE_OUT },
    a.voiceId ? { id: 'voice', track: 'vo', component: 'Audio', at: 8.3, len: 3.6, props: { assetId: a.voiceId, volume: 0.9, fadeOut: 0.2 } } : null
  ].filter((b): b is Beat => b !== null);
}

function threeD(l: Layout, a: TemplateAssets): Beat[] {
  const stage = inside(l.stage, 0.5, 0.5, 1.05, 1.1);
  const product: Beat = a.modelId
    ? { id: 'model', track: 'media', component: 'Model3D', at: 12.1, len: 3.9, props: { assetId: a.modelId, ...stage, startAngle: -50, endAngle: 200, zoom: 1.15, lighting: 'dramatic' }, enter: edge(TransitionKind.Scale, 0.45), exit: FADE_OUT }
    : { id: 'model', track: 'media', component: 'Shape3D', at: 12.1, len: 3.9, props: { shape: 'torus', ...stage, orbitSpeed: 60, lighting: 'dramatic' }, enter: edge(TransitionKind.Scale, 0.45), exit: FADE_OUT };
  return [...chapter(l, 3, '( 03 ) 3D', 'Products,\nin 3D.', 12, 4), product];
}

function agents(l: Layout): Beat[] {
  const panel = inside(l.stage, 0.5, 0.5, 0.9, 1);
  const live = { color: [[0, 'brand.text'], [2.5, 'brand.text'], [2.8, 'brand.accent', Ease.Standard]] as Key[], scale: [[0, 1], [2.5, 1], [2.9, 1.06, Ease.Overshoot]] as Key[] };
  return [
    ...chapter(l, 4, '( 04 ) Agents', 'Agents edit\nit live.', 16, 4.5, { keys: live, transform: { anchorX: 0 } }),
    { id: 'chat-panel', track: 'media', component: 'Shape', at: 16.05, len: 4.45, props: { shape: 'rect', fill: PAPER, ...panel }, enter: edge(TransitionKind.SlideLeft, 0.4), exit: FADE_OUT },
    { id: 'chat-head', track: 'ui', component: 'Kicker', at: 16.2, len: 4.3, props: { text: 'Chat', ...inside(panel, 0.5, 0.07, 0.86, 0.08), align: 'left', size: 0.024, color: INK, font: 'sans' }, exit: FADE_OUT },
    { id: 'chat-ask', track: 'ui', component: 'Caption', at: 16.6, len: 3.9, props: { text: 'Make the headline blue.', ...inside(panel, 0.5, 0.24, 0.86, 0.1), align: 'right', size: 0.026, background: LIGHT, color: INK }, keys: { scale: [[0, 0.9], [0.25, 1, Ease.Overshoot]] }, exit: FADE_OUT },
    { id: 'chat-tool', track: 'ui', component: 'Kicker', at: 17.6, len: 2.9, props: { text: 'set_props · title · colour', ...inside(panel, 0.5, 0.38, 0.86, 0.08), align: 'left', size: 0.02, color: SOFT }, enter: RISE, exit: FADE_OUT },
    { id: 'chat-done', track: 'ui', component: 'Caption', at: 18.6, len: 1.9, props: { text: 'Done. The headline is blue.', ...inside(panel, 0.5, 0.52, 0.86, 0.1), align: 'left', size: 0.026, background: INK, color: PAPER }, keys: { scale: [[0, 0.9], [0.25, 1, Ease.Overshoot]] }, exit: FADE_OUT },
    { id: 'chat-input', track: 'ui', component: 'Caption', at: 16.3, len: 4.2, props: { text: 'Ask the agent…', ...inside(panel, 0.5, 0.9, 0.86, 0.1), align: 'left', size: 0.024, background: LIGHT, color: '#9a9a9a' }, exit: FADE_OUT }
  ];
}

function publish(l: Layout, a: TemplateAssets): Beat[] {
  const days = 7;
  const weeks = 3;
  const grid = inside(l.stage, 0.66, 0.5, 0.62, 0.62);
  const cell = (i: number): Beat => {
    const col = i % days;
    const row = Math.floor(i / days);
    const scheduled = i === 9 || i === 12 || i === 16;
    return {
      id: `day-${i}`,
      track: 'media',
      component: 'Shape',
      at: 20.6 + i * 0.03,
      len: 3.9 - i * 0.03,
      props: { shape: 'rect', fill: scheduled ? 'brand.accent' : '#1c1c1c', ...inside(grid, (col + 0.5) / days, (row + 0.5) / weeks, 0.88 / days, 0.86 / weeks) },
      keys: scheduled ? { scale: [[0, 0], [1.4, 0], [1.75, 1, Ease.Overshoot]] } : { opacity: [[0, 0], [0.3, 1]] },
      exit: FADE_OUT
    };
  };
  const cursor = (id: string, label: string, colour: string, from: [number, number], to: [number, number]): Beat[] => {
    const start = inside(grid, from[0], from[1], 0.04, 0.06);
    const path = (delta: number): Key[] => [[0, 0], [0.8, 0], [2.2, delta, Ease.Standard]];
    const dx = (to[0] - from[0]) * grid.width;
    const dy = (to[1] - from[1]) * grid.height;
    return [
      { id: `${id}-arrow`, track: 'ui', component: 'Shape', at: 21, len: 3.5, props: { shape: 'rect', fill: colour, ...start, width: 0.02, height: 0.02 }, transform: { rotateZ: 45, scale: 0.6 }, keys: { x: path(dx), y: path(dy) }, exit: FADE_OUT },
      { id: `${id}-tag`, track: 'ui', component: 'Caption', at: 21, len: 3.5, props: { text: label, ...inside(grid, from[0] + 0.12, from[1] + 0.09, 0.3, 0.1), size: 0.02, background: colour, color: PAPER }, keys: { x: path(dx), y: path(dy) }, exit: FADE_OUT }
    ];
  };
  return [
    ...chapter(l, 5, '( 05 ) Publish', 'Ship it\neverywhere.', 20.5, 4),
    { id: 'post', track: 'media', component: 'SocialMockup', at: 20.6, len: 3.9, props: { assetId: a.imageId, handle: '@feega', caption: 'Made on one canvas.', ...inside(l.stage, 0.16, 0.5, 0.32, 0.86) }, enter: edge(TransitionKind.SlideUp, 0.4), exit: FADE_OUT },
    ...Array.from({ length: days * weeks }, (_, i) => cell(i)),
    ...cursor('you', 'You', '#0099ff', [0.1, 0.9], [0.36, 0.5]),
    ...cursor('agent', 'Agent', '#a855f7', [0.9, 0.1], [0.79, 0.82])
  ];
}

function end(l: Layout): Beat[] {
  return [
    { id: 'end-bg', track: 'bg', component: 'BrandBackground', at: 24.5, len: 3.5, props: { pattern: 'dots' }, mask: { kind: MaskKind.Ellipse, x: 0.5, y: 0.5, width: 0, height: 0 }, keys: { maskWidth: [[0, 0], [0.7, 2.4, Ease.Enter]], maskHeight: [[0, 0], [0.7, 2.4, Ease.Enter]] } },
    { id: 'end', track: 'text', component: 'Title', at: 24.7, len: 3.3, props: { text: 'Start on\nthe canvas.', x: 0.5, y: 0.44, width: 0.9, height: 0.42, size: l.end } },
    { id: 'end-url', track: 'text', component: 'Kicker', at: 25.2, len: 2.8, props: { text: 'feega.app', x: 0.5, y: 0.72, width: 0.6, size: 0.035 }, enter: RISE }
  ];
}

export function feegaTrailerV2(format: MotionFormat, a: TemplateAssets): MotionDoc {
  const l = LAYOUTS[format] ?? (LAYOUTS[MotionFormat.Landscape] as Layout);
  return assemble({
    format,
    seconds: SECONDS,
    tracks: TRACKS,
    beats: [
      { id: 'bg', track: 'bg', component: 'BrandBackground', at: 0, len: SECONDS },
      ...hook(l),
      ...generate(l, a),
      ...sound(l, a),
      ...threeD(l, a),
      ...agents(l),
      ...publish(l, a),
      ...end(l),
      a.musicId ? { id: 'music', track: 'music', component: 'Audio', at: 0, len: SECONDS, props: { assetId: a.musicId, volume: 0.85, fadeIn: 0.2, fadeOut: 2 } } : null
    ]
  });
}

export const TRAILER_V2_SECONDS = SECONDS;
