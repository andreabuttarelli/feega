import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { Ease } from '$lib/motion/design';
import { addClip, setKeyframes, type OpResult } from '$lib/motion/timeline';
import { FillType } from '$lib/motion/fill/model';

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
  blur: () => keys(must(addClip(shape(backdrop, 'sharp', { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.3, fill: '#ffd60a' }), { component: 'Shape', from: 0, durationInFrames: SECONDS, props: { shape: 'star', x: 0.7, y: 0.5, width: 0.25, height: 0.4, fill: '#bf5af2' }, effects: [{ id: 'g', kind: 'gaussian-blur', enabled: true, params: { radius: 6 } }] } as never, 'soft')), 'sharp', 'blur', 0, 24)
};

mkdirSync(out, { recursive: true });
for (const [name, build] of Object.entries(KINDS)) {
  writeFileSync(join(out, `kind-${name}.json`), JSON.stringify({ ...build(), durationInFrames: SECONDS }));
}
console.log(Object.keys(KINDS).map((k) => join(out, `kind-${k}.json`)).join(' '));
