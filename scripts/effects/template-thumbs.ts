import { join } from 'node:path';
import sharp from 'sharp';
import { LAYOUTS } from '../../packages/motion-core/src/canvas/composition/index';
import { CANVAS_TEMPLATES } from '../../src/lib/canvas/templates';
import { applyStack, type EffectStep, type Pixels } from '../../src/lib/canvas/effects/index';

const STATIC = 'static';
const SAMPLES = 'static/component-previews/samples';
const THUMB = { width: 480, height: 600 };
const TEXT_SCALE = 2.25;

type Source = { sample: string; scale: number; normalise: boolean };

const PIXEL_SOURCE: Source = { sample: 'p1074', scale: 1, normalise: false };
const SOURCE_BY_TEMPLATE: Record<string, Source> = {
  'fx-word-field': { sample: 'p1069', scale: TEXT_SCALE, normalise: true },
  'fx-word-silhouette': { sample: 'p1069', scale: TEXT_SCALE, normalise: true }
};

async function source({ sample, scale, normalise }: Source): Promise<Pixels> {
  const sized = sharp(join(SAMPLES, `${sample}.jpg`)).resize(Math.round(THUMB.width * scale), Math.round(THUMB.height * scale), { fit: 'cover' });
  const { data, info } = await (normalise ? sized.normalise() : sized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

for (const template of CANVAS_TEMPLATES.filter((t) => t.category === 'effects')) {
  const pixels = await source(SOURCE_BY_TEMPLATE[template.id] ?? PIXEL_SOURCE);
  const steps = template.nodes.find((n) => n.type === 'effects')!.data.effects as EffectStep[];
  const out = applyStack(pixels, steps);
  await sharp(Buffer.from(out.data), { raw: { width: out.width, height: out.height, channels: 4 } }).resize(THUMB.width, THUMB.height).webp({ quality: 80 }).toFile(join(STATIC, 'templates', `${template.id}.webp`));
}

for (const layout of Object.keys(LAYOUTS)) {
  await sharp(join(STATIC, 'component-previews', `builtin-composition-${layout}.jpg`)).resize(THUMB.width, THUMB.height, { fit: 'cover' }).webp({ quality: 80 }).toFile(join(STATIC, 'templates', `composition-${layout}.webp`));
}
