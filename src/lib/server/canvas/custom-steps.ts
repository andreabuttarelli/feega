import sharp from 'sharp';
import { applyStack, CUSTOM, type CustomStep, type EffectStep, type Pixels } from '$lib/canvas/effects';
import type { CustomEffect } from '$lib/canvas/effects/custom';
import type { GlPage } from '$lib/server/effects/check';

export type AsyncCustomPass = (pixels: Pixels, step: CustomStep) => Promise<Pixels>;

const FAILED = 'failed';
const PNG_PREFIX = 'data:image/png;base64,';

export async function applyStackAsync(pixels: Pixels, steps: EffectStep[], custom: AsyncCustomPass): Promise<Pixels> {
  let current = pixels;
  let pending: EffectStep[] = [];

  for (const step of steps) {
    if (step.id !== CUSTOM) {
      pending.push(step);
      continue;
    }

    current = applyStack(current, pending);
    pending = [];
    if (step.enabled) {
      current = await custom(current, step);
    }
  }

  return applyStack(current, pending);
}

async function toDataUrl(pixels: Pixels): Promise<string> {
  const png = await sharp(Buffer.from(pixels.data.buffer, pixels.data.byteOffset, pixels.data.length), { raw: { width: pixels.width, height: pixels.height, channels: 4 } }).png().toBuffer();
  return `${PNG_PREFIX}${png.toString('base64')}`;
}

async function fromDataUrl(url: string): Promise<Pixels> {
  const { data, info } = await sharp(Buffer.from(url.slice(PNG_PREFIX.length), 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
}

export function glPass(gl: GlPage | null, effects: CustomEffect[]): AsyncCustomPass {
  const byId = new Map(effects.map((e) => [e.id, e]));
  return async (pixels, step) => {
    const effect = byId.get(step.ref);
    if (!gl || !effect || effect.check.state === FAILED) {
      return pixels;
    }

    const still = { frag: effect.frag, params: effect.params, values: step.params, image: await toDataUrl(pixels) };
    const out = await gl.run<string>(`window.__shaderFx.renderStill(${JSON.stringify(still)})`).catch(() => null);
    return out?.startsWith(PNG_PREFIX) ? fromDataUrl(out) : pixels;
  };
}
