import { join } from 'node:path';
import sharp from 'sharp';
import { LAYOUTS } from '../../packages/motion-core/src/canvas/composition/index';
import { CANVAS_TEMPLATES } from '../../src/lib/canvas/templates';
import { applyStack, type EffectStep, type Pixels } from '../../src/lib/canvas/effects/index';

const STATIC = 'static';
const SAMPLE = 'static/component-previews/samples/p1074.jpg';
const THUMB = { width: 480, height: 600 };

async function source(): Promise<Pixels> {
  const { data, info } = await sharp(SAMPLE).resize(THUMB.width, THUMB.height, { fit: 'cover' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

const pixels = await source();
for (const template of CANVAS_TEMPLATES.filter((t) => t.category === 'effects')) {
  const steps = template.nodes.find((n) => n.type === 'effects')!.data.effects as EffectStep[];
  const out = applyStack(pixels, steps);
  await sharp(Buffer.from(out.data), { raw: { width: out.width, height: out.height, channels: 4 } }).webp({ quality: 80 }).toFile(join(STATIC, 'templates', `${template.id}.webp`));
}

for (const layout of Object.keys(LAYOUTS)) {
  await sharp(join(STATIC, 'component-previews', `builtin-composition-${layout}.jpg`)).resize(THUMB.width, THUMB.height, { fit: 'cover' }).webp({ quality: 80 }).toFile(join(STATIC, 'templates', `composition-${layout}.webp`));
}
