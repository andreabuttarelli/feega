import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { Ease } from '$lib/motion/design';
import { addClip, setKeyframes, type OpResult } from '$lib/motion/timeline';
import { FillType } from '$lib/motion/fill/model';
import { maskSchema } from '$lib/motion/mask';
import { registerFont } from '$lib/motion/fonts/ops';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { addAnimator, applyPreset, TextPreset } from '$lib/motion/text-animators/ops';

const SECONDS = 60;
const out = process.argv[2];

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const backdrop = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: SECONDS }, 'bg'));
const shape = (doc: MotionDoc, id: string, props: Record<string, unknown>) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: SECONDS, props }, id));
const keys = (doc: MotionDoc, id: string, prop: string, from: number, to: number) => must(setKeyframes(doc, id, prop, [{ frame: 0, value: from, ease: Ease.Standard }, { frame: SECONDS - 1, value: to, ease: Ease.Standard }]));
const clip = (doc: MotionDoc, component: string, id: string, props: Record<string, unknown>) => must(addClip(doc, { component, from: 0, durationInFrames: SECONDS, props } as never, id));
const fonts = (doc: MotionDoc, families: string[]) => families.reduce((d, f) => must(registerFont(d, f, GOOGLE_FONTS)), doc);
const stops = [{ color: '#ff3b30', pos: 0 }, { color: '#0a84ff', pos: 0.6 }, { color: '#30d158', pos: 1 }];

const geometry = [
  ['rect', { shape: 'rect', x: 0.2, y: 0.3, width: 0.2, height: 0.25, fill: '#ff3b30' }],
  ['round', { shape: 'rect', x: 0.5, y: 0.3, width: 0.2, height: 0.25, roundness: 0.2, fill: '#ffd60a' }],
  ['ellipse', { shape: 'ellipse', x: 0.8, y: 0.3, width: 0.2, height: 0.25, fill: '#0a84ff' }],
  ['star', { shape: 'star', x: 0.2, y: 0.75, width: 0.2, height: 0.3, points: 7, fill: '#30d158' }],
  ['polygon', { shape: 'polygon', x: 0.5, y: 0.75, width: 0.2, height: 0.3, sides: 6, roundness: 0.1, fill: '#bf5af2' }],
  ['path', { shape: 'path', x: 0.8, y: 0.75, width: 0.2, height: 0.3, path: 'M0 1 C0.2 0 0.8 0 1 1 Z M0.3 0.8 L0.7 0.8 L0.5 0.4 Z', fillRule: 'evenodd', fill: '#ff9f0a' }]
] as const;

const KINDS: Record<string, () => MotionDoc> = {
  background: () => backdrop,
  shapes: () => geometry.reduce((doc, [id, props]) => shape(doc, id, props), backdrop),
  gradients: () => shape(shape(backdrop, 'lin', { shape: 'rect', x: 0.3, y: 0.5, width: 0.35, height: 0.6, roundness: 0.05, fills: [{ type: FillType.Linear, angle: 30, stops }] }), 'rad', { shape: 'ellipse', x: 0.72, y: 0.5, width: 0.3, height: 0.55, fills: [{ type: FillType.Radial, center: { x: 0.4, y: 0.4 }, radius: 1, stops }] }),
  transforms: () => keys(keys(keys(shape(backdrop, 'card', { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.3, roundness: 0.1, fill: '#0a84ff', rotation: 15 }), 'card', 'rotateZ', 0, 180), 'card', 'scale', 0.6, 1.4), 'card', 'x', -0.3, 0.3),
  opacity: () => keys(shape(shape(backdrop, 'under', { shape: 'rect', x: 0.45, y: 0.5, width: 0.3, height: 0.4, fill: '#ff3b30' }), 'over', { shape: 'ellipse', x: 0.55, y: 0.5, width: 0.3, height: 0.5, fill: '#30d158', opacity: 0.7 }), 'over', 'opacity', 0.2, 1),
  images: () => must(addClip(must(addClip(must(addClip(backdrop, { component: 'Image', from: 0, durationInFrames: SECONDS, props: { assetId: 'pic-a', x: 0.27, y: 0.5, width: 0.4, height: 0.6, focusX: 0.2 } }, 'cover')), { component: 'Image', from: 0, durationInFrames: SECONDS, props: { assetId: 'pic-b', fit: 'contain', x: 0.73, y: 0.3, width: 0.4, height: 0.3 } }, 'contain')), { component: 'Logo', from: 0, durationInFrames: SECONDS, props: { assetId: 'pic-c', x: 0.73, y: 0.75, width: 0.2, height: 0.2 } }, 'logo')),
  zoom: () => keys(keys(must(addClip(backdrop, { component: 'Image', from: 0, durationInFrames: SECONDS, props: { assetId: 'pic-a', x: 0.5, y: 0.5, width: 0.6, height: 0.6 } }, 'kb')), 'kb', 'zoom', 1, 1.6), 'kb', 'rotateZ', 0, 8),
  video: () => must(addClip(backdrop, { component: 'Video', from: 0, durationInFrames: SECONDS, props: { assetId: 'video-a', x: 0.5, y: 0.5, width: 0.7, height: 0.7, speed: 1.5 } }, 'vid')),
  strokes: () =>
    [
      ['center', { shape: 'rect', x: 0.2, y: 0.3, width: 0.18, height: 0.25, roundness: 0.1, fill: '#1c1c1e', strokes: [{ paint: { type: 'solid', color: '#ff9f0a' }, width: 0.012, align: 'center' }] }],
      ['inside', { shape: 'ellipse', x: 0.5, y: 0.3, width: 0.18, height: 0.25, fill: '#1c1c1e', strokes: [{ paint: { type: 'solid', color: '#30d158' }, width: 0.015, align: 'inside' }] }],
      ['outside', { shape: 'star', x: 0.8, y: 0.3, width: 0.18, height: 0.3, fill: '#1c1c1e', strokes: [{ paint: { type: 'solid', color: '#0a84ff' }, width: 0.01, align: 'outside', join: 'round' }] }],
      ['dashed', { shape: 'rect', x: 0.2, y: 0.75, width: 0.2, height: 0.25, fills: [], strokes: [{ paint: { type: 'solid', color: '#ffffff' }, width: 0.006, dash: 0.03, gap: 0.015 }] }],
      ['open', { shape: 'path', x: 0.5, y: 0.75, width: 0.2, height: 0.25, path: 'M0 1 L0.3 0 L0.6 0.8 L1 0.1', fills: [], strokes: [{ paint: { type: 'solid', color: '#ff375f' }, width: 0.012, cap: 'round', join: 'round' }] }],
      ['graded', { shape: 'polygon', x: 0.8, y: 0.75, width: 0.18, height: 0.28, sides: 5, fills: [], strokes: [{ paint: { type: 'linear-gradient', angle: 0, stops }, width: 0.014, cap: 'square', join: 'bevel' }] }]
    ].reduce((doc, [id, props]) => shape(doc, id as string, props as Record<string, unknown>), backdrop),
  transitions: () =>
    ['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'scale', 'wipe', 'blur'].reduce((doc, kind, i) => {
      const placed = shape(doc, kind, { shape: 'rect', x: 0.14 + (i % 4) * 0.24, y: i < 4 ? 0.3 : 0.72, width: 0.16, height: 0.25, roundness: 0.1, fill: ['#ff3b30', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f'][i] });
      return { ...placed, tracks: placed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === kind ? { ...c, transitionIn: { kind, durationInFrames: 24 }, transitionOut: { kind, durationInFrames: 24 } } : c)) })) } as MotionDoc;
    }, backdrop),
  moves: () =>
    ['drift-up', 'zoom-in', 'pan-left'].reduce((doc, move, i) => must(addClip(doc, { component: 'Image', from: 0, durationInFrames: SECONDS, props: { assetId: 'pic-a', x: 0.18 + i * 0.32, y: 0.5, width: 0.28, height: 0.5, move, easing: 'linear' } }, move)), backdrop),
  blends: () =>
    ['multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].reduce(
      (doc, blend, i) => {
        const placed = shape(doc, blend, { shape: 'ellipse', x: 0.1 + (i % 5) * 0.2, y: 0.2 + Math.floor(i / 5) * 0.3, width: 0.12, height: 0.22, fills: [{ type: 'linear-gradient', angle: 0, stops }] });
        return { ...placed, tracks: placed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === blend ? { ...c, blend } : c)) })) } as MotionDoc;
      },
      must(addClip(backdrop, { component: 'Image', from: 0, durationInFrames: SECONDS, props: { assetId: 'pic-a', x: 0.5, y: 0.5, width: 1, height: 1 } }, 'under'))
    ),
  masks: () => {
    const cell = (i: number) => ({ x: 0.14 + (i % 4) * 0.24, y: i < 4 ? 0.3 : 0.72 });
    const specs: Record<string, unknown>[] = [
      { kind: 'rect', width: 0.12, height: 0.18, feather: 10 },
      { kind: 'ellipse', width: 0.14, height: 0.22, invert: true },
      { kind: 'polygon', width: 0.16, height: 0.26, rotation: 20 },
      { kind: 'linear', width: 0.18, height: 0.3, rotation: 90 },
      { kind: 'radial', width: 0.2, height: 0.3 },
      { kind: 'luma', assetId: 'pic-a', width: 0.2, height: 0.3 },
      { kind: 'image', assetId: 'pic-c', width: 0.2, height: 0.3, opacity: 0.6 },
      { kind: 'rect', width: 0.18, height: 0.28, stack: { kind: 'ellipse', mode: 'subtract', width: 0.1, height: 0.16 } }
    ];
    return specs.reduce((doc, spec, i) => {
      const { stack, ...own } = spec as { stack?: Record<string, unknown> };
      const id = `m${i}`;
      const placed = shape(doc, id, { shape: 'rect', ...cell(i), width: 0.2, height: 0.3, fills: [{ type: 'linear-gradient', angle: 45, stops }] });
      const mask = maskSchema.parse({ ...own, ...cell(i) });
      const maskStack = stack ? [maskSchema.parse({ ...stack, ...cell(i) })] : [];
      return { ...placed, tracks: placed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, mask, maskStack } : c)) })) } as MotionDoc;
    }, backdrop);
  },
  mattes: () => {
    const lower = shape(shape(backdrop, 'alpha', { shape: 'rect', x: 0.3, y: 0.5, width: 0.35, height: 0.6, fills: [{ type: 'linear-gradient', angle: 0, stops }] }), 'luma', { shape: 'rect', x: 0.72, y: 0.5, width: 0.35, height: 0.6, fills: [{ type: 'linear-gradient', angle: 90, stops }] });
    const template = lower.tracks.flatMap((t) => t.clips).find((c) => c.id === 'alpha')!;
    const hole = (id: string, x: number, fill: string) => ({ ...template, id, props: { ...template.props, shape: 'star', x, y: 0.5, width: 0.3, height: 0.5, fills: [{ type: 'solid', color: fill }] } });
    const top = { ...lower.tracks[0], id: 'mattes', clips: [hole('star-a', 0.3, '#ffffff'), hole('star-l', 0.72, '#888888')] };
    const stacked = { ...lower, tracks: [top, ...lower.tracks] };
    return { ...stacked, tracks: stacked.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'alpha' ? { ...c, matte: 'alpha', matteFrom: 'star-a' } : c.id === 'luma' ? { ...c, matte: 'luma-inverted', matteFrom: 'star-l' } : c)) })) } as MotionDoc;
  },
  effects: () => {
    const list: [string, Record<string, number | string>][] = [
      ['brightness-contrast', { brightness: 1.3, contrast: 1.4 }],
      ['hue-saturation', { hue: 90, saturation: 1.6 }],
      ['tint', { black: '#1d1d6b', white: '#ffd9a0', amount: 0.8 }],
      ['curves', { shadows: 0.1, midtones: 0.7, highlights: 0.9 }],
      ['black-white', { amount: 1 }],
      ['gaussian-blur', { radius: 6 }],
      ['directional-blur', { length: 40, angle: 30 }],
      ['drop-shadow', { distance: 18, angle: 135, blur: 20, color: '#000000', opacity: 0.8 }],
      ['inner-shadow', { distance: 10, angle: 90, blur: 12, color: '#000000', opacity: 0.7 }],
      ['glow', { radius: 30, color: '#ffd60a', intensity: 0.9 }],
      ['stroke', { width: 6, color: '#ffffff' }],
      ['chromatic-aberration', { offset: 8, angle: 0 }],
      ['vignette', { amount: 0.7 }],
      ['levels', { inBlack: 0.1, inWhite: 0.8, gamma: 1.4, outBlack: 0.05, outWhite: 0.95 }],
      ['lift-gamma-gain', { liftR: 0.1, gammaG: 1.3, gainB: 1.4 }],
      ['gaussian-blur', { radius: 2 }]
    ];
    const under = must(addClip(backdrop, { component: 'Image', from: 0, durationInFrames: SECONDS, props: { assetId: 'pic-b', x: 0.5, y: 0.5, width: 1, height: 1 } }, 'under'));
    return list.reduce((doc, [kind, params], i) => {
      const id = `fx${i}`;
      const placed = must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: SECONDS, props: { shape: i === 15 ? 'rect' : 'star', x: 0.125 + (i % 4) * 0.25, y: 0.125 + Math.floor(i / 4) * 0.25, width: 0.12, height: 0.18, fills: i === 15 ? [{ type: 'solid', color: '#ffffff', opacity: 0.2 }] : [{ type: 'linear-gradient', angle: 45, stops }] } }, id));
      return { ...placed, tracks: placed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, effects: [{ id: 'e', kind, enabled: true, params }] } : c)) })) } as MotionDoc;
    }, under);
  },
  noise: () =>
    [
      ['grain', 'noise', { amount: 0.5, size: 2, evolve: 1 }, 0.27],
      ['wave', 'wave', { amount: 30, scale: 120, speed: 200 }, 0.73]
    ].reduce((doc, [id, kind, params, x]) => {
      const placed = must(addClip(doc, { component: 'Image', from: 0, durationInFrames: SECONDS, props: { assetId: 'pic-a', x, y: 0.5, width: 0.4, height: 0.6 } }, id as string));
      return { ...placed, tracks: placed.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, effects: [{ id: 'e', kind, enabled: true, params }] } : c)) })) } as MotionDoc;
    }, backdrop),
  backdrop: () => {
    const under = must(addClip(backdrop, { component: 'Image', from: 0, durationInFrames: SECONDS, props: { assetId: 'pic-a', x: 0.5, y: 0.5, width: 1, height: 1 } }, 'under'));
    const glass = shape(under, 'glass', { shape: 'rect', x: 0.5, y: 0.5, width: 0.4, height: 0.4, roundness: 0.1, fills: [{ type: 'solid', color: '#ffffff', opacity: 0.25 }] });
    return { ...glass, tracks: glass.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'glass' ? { ...c, effects: [{ id: 'e', kind: 'background-blur', enabled: true, params: { radius: 14 } }] } : c)) })) } as MotionDoc;
  },
  title: () => clip(backdrop, 'Title', 'title', {}),
  text: () => clip(clip(backdrop, 'Text', 'body', { text: 'Body copy wraps inside its box and keeps   spaces.\nA second paragraph, left aligned.', align: 'left', width: 0.4, y: 0.4 }), 'Text', 'hug', { text: 'Auto width', sizing: 'auto', x: 0.3, y: 0.8, width: 0.2, height: 0.06 }),
  kicker: () => clip(clip(backdrop, 'Kicker', 'kicker', {}), 'Kicker', 'right', { text: 'Right aligned label', align: 'right', y: 0.6 }),
  caption: () => clip(clip(backdrop, 'Caption', 'caption', {}), 'Caption', 'long', { text: 'A longer caption that wraps onto a second line in the box', width: 0.4, y: 0.5, height: 0.3 }),
  fonts: () =>
    clip(
      clip(clip(fonts(backdrop, ['Inter', 'Playfair Display', 'Fraunces', 'Space Grotesk']), 'Title', 'inter', { text: 'Variable weight', font: 'Inter', weight: 800, tracking: -0.05, y: 0.2, height: 0.25 }), 'Text', 'playfair', { text: 'An italic serif, set in Playfair', font: 'Playfair Display', italic: true, size: 0.06, y: 0.45 }),
      'Kicker',
      'fraunces',
      { text: 'soft wonky axes', font: 'Fraunces', weight: 600, axes: "'SOFT' 100, 'WONK' 1", size: 0.05, y: 0.62 }
    ),
  grotesk: () => clip(fonts(backdrop, ['Space Grotesk']), 'Text', 'grotesk', { text: 'Space Grotesk at 700, centred', font: 'Space Grotesk', weight: 700, size: 0.07 }),
  animators: () => {
    const placed = clip(clip(clip(backdrop, 'Text', 'rise', { text: 'Rise out of the blur', size: 0.08, y: 0.25 }), 'Text', 'words', { text: 'Words step up one by one', size: 0.06, y: 0.5 }), 'Kicker', 'spin', { text: 'turn scale tint', size: 0.06, y: 0.75 });
    const risen = must(applyPreset(placed, 'rise', TextPreset.BlurUp, { start: 0, duration: SECONDS }, 'a'));
    const stepped = must(applyPreset(risen, 'words', TextPreset.WordStagger, { start: 0, duration: SECONDS }, 'a'));
    const spun = must(addAnimator(stepped, 'spin', 'a', { shape: 'smooth' as never, softness: 0.3, start: 0, end: 200, values: { rotation: 45, scale: 1.6, color: '#ff375f', opacity: 0.3 } }));
    return keys(spun, 'spin', 'ta.a.offset', -130, 100);
  },
  pivot: () =>
    clip(
      clip(clip(backdrop, 'Title', 'edge', { text: 'Edge title', x: 0.12, y: 0.25, width: 0.4, height: 0.3, rotation: 20, scale: 1.2 }), 'Text', 'tall', { text: 'Auto height, turned', sizing: 'auto-height', x: 0.6, y: 0.5, width: 0.3, height: 0.6, rotation: -30 }),
      'Text',
      'wide',
      { text: 'Auto width', sizing: 'auto', x: 0.3, y: 0.8, width: 0.4, height: 0.2, rotation: 45, scale: 0.8 }
    ),
  painted: () => {
    const linear = [{ type: FillType.Linear, angle: 20, stops }];
    const radial = [{ type: FillType.Radial, center: { x: 0.3, y: 0.4 }, radius: 1.2, stops }];
    const outline = (color: string, align: string) => [{ paint: { type: FillType.Solid, color }, width: 0.004, align }];
    const titled = clip(backdrop, 'Title', 'grad', { text: 'Gradient title\nsecond line', y: 0.22, height: 0.35, fills: linear });
    const body = clip(titled, 'Text', 'body', { text: 'Radial body copy that wraps onto two lines', align: 'left', size: 0.06, x: 0.3, y: 0.62, width: 0.45, height: 0.25, fills: radial });
    const kicker = clip(body, 'Kicker', 'kick', { text: 'outside stroke', size: 0.06, x: 0.75, y: 0.62, fills: [{ type: FillType.Solid, color: '#ffffff' }], strokes: outline('#ff375f', 'outside') });
    return clip(kicker, 'Caption', 'cap', { text: 'Centred stroke, mixed fills', x: 0.5, y: 0.88, size: 0.04, fills: [{ type: FillType.Solid, color: '#0a84ff' }, { type: FillType.Solid, color: '#ffd60a', opacity: 0.5 }], strokes: outline('#30d158', 'center') });
  },
  blur: () => keys(must(addClip(shape(backdrop, 'sharp', { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.3, fill: '#ffd60a' }), { component: 'Shape', from: 0, durationInFrames: SECONDS, props: { shape: 'star', x: 0.7, y: 0.5, width: 0.25, height: 0.4, fill: '#bf5af2' }, effects: [{ id: 'g', kind: 'gaussian-blur', enabled: true, params: { radius: 6 } }] } as never, 'soft')), 'sharp', 'blur', 0, 24)
};

mkdirSync(out, { recursive: true });
for (const [name, build] of Object.entries(KINDS)) {
  writeFileSync(join(out, `kind-${name}.json`), JSON.stringify({ ...build(), durationInFrames: SECONDS }));
}
console.log(Object.keys(KINDS).map((k) => join(out, `kind-${k}.json`)).join(' '));
