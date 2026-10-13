import { FORMATS, MotionFormat, type MotionDoc } from '$lib/motion/doc';
import { ComponentMode, PropFormat, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { EffectKind } from '$lib/motion/effects/registry';
import { addEffect } from '$lib/motion/effects/ops';
import { setStill } from '$lib/motion/still';
import type { OpResult } from '$lib/motion/timeline';
import { customTemplateDoc, type CustomTemplateSpec } from './custom-template';

export const POSTER_SECONDS = 2;
export const POSTER_FORMAT = MotionFormat.Portrait;
export const GRAIN_EFFECT = 'grain';

export const NOISE_DATA_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.4'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>";

const must = (name: string, result: OpResult): MotionDoc => {
  if (!result.ok) {
    throw new Error(`${name}: ${result.error}`);
  }
  return result.doc;
};

export function posterTemplateDoc(spec: Omit<CustomTemplateSpec, 'seconds' | 'fps'>, grain: number): MotionDoc {
  const doc = customTemplateDoc({ ...spec, seconds: POSTER_SECONDS, fps: 30 });
  const { width, height } = FORMATS[POSTER_FORMAT];
  const grained = must(spec.name, addEffect({ ...doc, width, height }, spec.clip, EffectKind.Noise, GRAIN_EFFECT, { amount: grain, size: 1.2, evolve: 0 }));
  return must(spec.name, setStill(grained, 0));
}

export const textProp = (title: string, value: string, extra: Partial<PropSpec> = {}): PropSpec => ({ type: 'string', title, default: value, group: 'Content', ...extra });
export const linesProp = (title: string, value: string, maxLength = 600): PropSpec => textProp(title, value, { format: PropFormat.Textarea, maxLength });
export const numberProp = (title: string, value: number, minimum: number, maximum: number, step: number, group: PropSpec['group'] = 'Layout'): PropSpec => ({ type: 'number', title, default: value, minimum, maximum, group, step });
export const colourProp = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Color, default: value, group: 'Style' });
export const fontProp = (title: string, value: string): PropSpec => ({ type: 'string', title, format: PropFormat.Font, default: value, group: 'Style' });
export const prefixProp = (prefix: string): PropSpec => textProp('Runtime variable prefix', prefix, { group: 'Layout', maxLength: 20 });

const POSTER_HELPERS = String.raw`
const fontOf = (f) => (String(f).includes(',') ? f : '"' + f + '", system-ui, sans-serif');
const escaped = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const linesOf = (s) => String(s || '').split('\n');
const box = (x, y, w, h) => 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;';
const upright = (text, x, bottom, px, colour) =>
  '<div style="position:absolute;left:' + x + 'px;top:' + bottom + 'px;font-size:' + px + 'px;line-height:1;white-space:pre;letter-spacing:0.08em;text-transform:uppercase;transform:rotate(-90deg);transform-origin:0 0;color:' + colour + '">' + escaped(text) + '</div>';
`;

const POSTER_RUN = String.raw`
let drawn = '';
const run = () => {
  const p = { ...props };
  const width = scene.clientWidth || 1080;
  const height = scene.clientHeight || 1350;
  const key = JSON.stringify([p, width, height, document.fonts ? document.fonts.status : 'loaded']);
  if (key === drawn) {
    return;
  }
  drawn = key;
  draw(p, width, height);
};

run();
if (document.fonts) {
  document.fonts.ready.then(() => {
    drawn = '';
    run();
  });
}
tl.to({}, { duration, ease: 'none', onUpdate: run }, 0);
`;

export type PosterSource = { css: string; js: string };

export function posterComponent(source: PosterSource, props: Record<string, PropSpec>): CustomComponent {
  return {
    source: { html: '', css: source.css.trim(), js: [POSTER_HELPERS, source.js, POSTER_RUN].map((s) => s.trim()).join('\n\n') },
    propsSchema: { type: 'object', properties: props },
    mode: ComponentMode.Deterministic,
    version: 1,
    check: null
  };
}
