import type { BrandTokens } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setCanvas, setKeyframes, setProps, setTransform, type NewClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { setExpression } from '@feega/motion-core/motion/expression/ops';
import { Ease } from '@feega/motion-core/motion/design';
import { PlayMode } from '@feega/motion-core/motion/interactive/settings';
import { styleTextRange } from '../../../src/lib/motion/text-run-ops';

export const HERO_ID = 'lumen-hero';
export const HERO_LINK = 'https://docs.feega.app/motion/interactive-embeds/';
export const HERO_FRAMES = 120;
export const SCROLL_VIEWPORTS = 3;

export const HERO_TOKENS: BrandTokens = {
  name: 'Lumen',
  colors: { 'brand.primary': '#f4f5ff', 'brand.secondary': '#8f9bc7', 'brand.accent': '#6d4aff', 'brand.background': '#0a0f1f', 'brand.text': '#f4f5ff' },
  logoUrl: null
};

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

type Step = (doc: MotionDoc) => MotionDoc;

const clip = (id: string, component: NewClip['component'], props: Record<string, unknown>, transform: Record<string, number> = {}): Step => (doc) => {
  const added = must(addClip(doc, { component, from: 0, durationInFrames: HERO_FRAMES, props }, id));
  return Object.keys(transform).length ? must(setTransform(added, id, transform)) : added;
};

const live = (id: string, key: string, source: string): Step => (doc) => must(setExpression(doc, id, key, source));

const INTRO_FRAMES = 60;

const grow = (id: string, key: string, from: number, to: number): Step => (doc) =>
  must(setKeyframes(doc, id, key, [{ frame: 0, value: from, ease: Ease.Linear }, { frame: INTRO_FRAMES, value: to, ease: Ease.Standard }]));

const px = (axis: 'pointer.x' | 'pointer.y', seconds: number, reach: number) => `value + (input.smooth(input.${axis}, ${seconds}) - 0.5) * ${reach}`;

const drift = (id: string, reach: number): Step[] => [live(id, 'x', px('pointer.x', 0.2, reach)), live(id, 'y', px('pointer.y', 0.2, reach * 0.7))];

const BAR_HEIGHTS = [0.1, 0.16, 0.13, 0.22, 0.19, 0.3];
const BAR_LEFT = 0.625;
const BAR_STEP = 0.046;
const BAR_BASE = 0.7;

const bars: Step[] = BAR_HEIGHTS.flatMap((h, i) => {
  const id = `bar${i}`;
  const last = i === BAR_HEIGHTS.length - 1;
  return [
    clip(id, 'Shape', { shape: 'rect', x: BAR_LEFT + i * BAR_STEP, y: BAR_BASE - h / 2, width: 0.03, height: h, roundness: 0.3, fillKind: 'linear', fill: last ? '#19c3ff' : '#6d4aff', fill2: last ? '#6d4aff' : '#3b2fb8', gradientAngle: 90 }, { anchorY: 1 }),
    grow(id, 'scaleY', 0.04, 1),
    ...drift(id, 0.07)
  ];
});

const scrolled = (playback: PlayMode) => (playback === PlayMode.Scrub ? 'input.scroll' : 'clamp((input.scroll - 0.5) * 2, 0, 1)');

const steps = (playback: PlayMode): Step[] => [
  clip('bg', 'BrandBackground', {}),
  clip('glowA', 'Shape', { shape: 'ellipse', x: 0.78, y: 0.38, width: 0.6, height: 1.05, fillKind: 'radial', fill: '#6d4aff', fill2: 'transparent' }, { opacity: 0.55 }),
  grow('glowA', 'x', 0.9, 0.78),
  live('glowA', 'x', px('pointer.x', 0.4, -0.14)),
  live('glowA', 'opacity', 'value + input.smooth(input.hover, 0.3) * 0.2 + input.smooth(input.pointer.down, 0.15) * 0.25'),
  clip('glowB', 'Shape', { shape: 'ellipse', x: 0.18, y: 0.98, width: 0.55, height: 0.8, fillKind: 'radial', fill: '#19c3ff', fill2: 'transparent' }, { opacity: 0.28 }),
  live('glowB', 'x', px('pointer.x', 0.5, -0.1)),
  clip('kicker', 'Kicker', { text: 'NEW  ·  LUMEN 2.0 IS HERE', x: 0.3, y: 0.2, width: 0.46, height: 0.06, align: 'left', size: 0.021, tracking: 0.08, color: '#9b8cff' }),
  clip('headline', 'Title', { text: 'Ship the design\nyour code deserves.', x: 0.3, y: 0.4, width: 0.46, height: 0.3, align: 'left', size: 0.074, weight: 600, color: '#f4f5ff' }),
  clip('sub', 'Text', { text: 'Lumen turns every Figma file into clean, production-ready React in minutes, and keeps both in sync.', x: 0.27, y: 0.605, width: 0.4, height: 0.14, align: 'left', size: 0.0265, color: '#aeb7d6', leading: 1.35 }),
  clip('cta', 'Shape', { shape: 'rect', x: 0.1725, y: 0.79, width: 0.21, height: 0.095, roundness: 0.5, fillKind: 'linear', fill: '#7a5cff', fill2: '#2f8cff', gradientAngle: 0 }),
  live('cta', 'scale', 'value - input.smooth(input.pointer.down, 0.08) * 0.06 + input.smooth(input.hover, 0.25) * 0.015'),
  clip('ctaLabel', 'Text', { text: 'Start building free', x: 0.1725, y: 0.79, width: 0.21, height: 0.095, align: 'center', verticalAlign: 'center', size: 0.0285, weight: 600, color: '#ffffff', tracking: -0.01 }),
  live('ctaLabel', 'scale', 'value - input.smooth(input.pointer.down, 0.08) * 0.06 + input.smooth(input.hover, 0.25) * 0.015'),
  clip('docs', 'Text', { text: 'Read how interactive embeds work →', x: 0.445, y: 0.79, width: 0.3, height: 0.08, align: 'left', verticalAlign: 'center', size: 0.0245, color: '#cdd4f0' }),
  clip('card', 'Shape', { shape: 'rect', x: 0.74, y: 0.53, width: 0.36, height: 0.64, roundness: 0.05, fillKind: 'linear', fill: '#18214a', fill2: '#0f1633', gradientAngle: 120, strokeKind: 'solid', stroke: '#2d3a73', strokeWidth: 0.002 }),
  live('card', 'x', px('pointer.x', 0.22, 0.04)),
  live('card', 'y', `${px('pointer.y', 0.22, 0.028)} - ${scrolled(playback)} * 0.05`),
  live('card', 'scale', 'value + input.smooth(input.hover, 0.25) * 0.03 - input.smooth(input.pointer.down, 0.1) * 0.015'),
  clip('cardKicker', 'Kicker', { text: 'REVENUE · LAST 30 DAYS', x: 0.74, y: 0.285, width: 0.3, height: 0.05, align: 'left', size: 0.0155, tracking: 0.07, color: '#8f9bc7' }),
  ...drift('cardKicker', 0.05),
  clip('revenue', 'Title', { text: '$48,210', x: 0.74, y: 0.375, width: 0.3, height: 0.11, align: 'left', size: 0.062, weight: 600, color: '#ffffff' }),
  ...drift('revenue', 0.055),
  clip('delta', 'Text', { text: '▲ 18.4% vs last month', x: 0.74, y: 0.455, width: 0.3, height: 0.05, align: 'left', size: 0.0185, color: '#3ddc97' }),
  ...drift('delta', 0.05),
  ...bars,
  clip('chip', 'Shape', { shape: 'rect', x: 0.885, y: 0.255, width: 0.115, height: 0.065, roundness: 0.5, fillKind: 'solid', fill: '#112a35', strokeKind: 'solid', stroke: '#2a6b57', strokeWidth: 0.0015 }),
  ...drift('chip', 0.11),
  clip('chipLabel', 'Text', { text: '● Synced', x: 0.885, y: 0.255, width: 0.115, height: 0.065, align: 'center', verticalAlign: 'center', size: 0.0175, color: '#3ddc97' }),
  ...drift('chipLabel', 0.11),
  clip('track', 'Shape', { shape: 'rect', x: 0.5, y: 0.955, width: 0.86, height: 0.006, roundness: 0.5, fillKind: 'solid', fill: '#1d2750' }),
  clip('progress', 'Shape', { shape: 'rect', x: 0.5, y: 0.955, width: 0.86, height: 0.006, roundness: 0.5, fillKind: 'linear', fill: '#6d4aff', fill2: '#19c3ff', gradientAngle: 0 }, { anchorX: 0 }),
  live('progress', 'scaleX', `${scrolled(playback)} + 0.001`),
  live('glowB', 'y', `value - ${scrolled(playback)} * 0.2`)
];

export function heroDoc(playback: PlayMode = PlayMode.Autoplay): MotionDoc {
  const base = must(setCanvas(newMotionDoc(MotionFormat.Landscape), { durationInFrames: HERO_FRAMES }));
  const built = steps(playback).reduce((doc, step) => step(doc), base);
  const linked = must(styleTextRange(built, 'docs', { start: 0, end: 'Read how interactive embeds work'.length }, { link: HERO_LINK, underline: true }));
  return { ...linked, interactive: { playback, loop: false, outside: 'fallback', scrollLength: SCROLL_VIEWPORTS, vars: [], bindings: [] } } as unknown as MotionDoc;
}

export const heroSource = (playback: PlayMode = PlayMode.Autoplay, title = 'Lumen hero') => ({ doc: heroDoc(playback), tokens: HERO_TOKENS, assetUrls: {}, title, fetchBlob: async () => new Blob() });
