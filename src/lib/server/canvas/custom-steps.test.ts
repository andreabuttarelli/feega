import { afterAll, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import shaderRuntime from 'virtual:motion-shader-fx';
import type { GlPage } from '$lib/server/effects/check';
import { makePixels } from '$lib/canvas/effects/test-helpers';
import type { EffectStep, Pixels } from '$lib/canvas/effects';
import { applyStackAsync, glPass } from './custom-steps';

const grey = () => makePixels(2, 1, () => [100, 100, 100, 255]);

describe('applyStackAsync', () => {
  it('runs built-ins on the CPU and custom steps through the async pass, in stack order', async () => {
    const seen: number[] = [];
    const custom = vi.fn(async (pixels: Pixels) => {
      seen.push(pixels.data[0]);
      return { ...pixels, data: pixels.data.map((v, i) => (i % 4 === 3 ? v : 255 - v)) };
    });
    const steps: EffectStep[] = [
      { id: 'posterize', params: { levels: 2 }, enabled: true },
      { id: 'custom', ref: 'fx-1', params: {}, enabled: true }
    ];

    const out = await applyStackAsync(grey(), steps, custom);

    expect(seen).toEqual([0]);
    expect(out.data[0]).toBe(255);
  });

  it('skips disabled custom steps', async () => {
    const custom = vi.fn(async (p: Pixels) => p);

    await applyStackAsync(grey(), [{ id: 'custom', ref: 'fx-1', params: {}, enabled: false }], custom);

    expect(custom).not.toHaveBeenCalled();
  });
});

let browser: Browser | null = null;

const playwrightGl: GlPage = {
  run: async <T,>(script: string) => {
    browser ??= await chromium.launch();
    const page = await browser.newPage();
    try {
      await page.setContent(`<script>${shaderRuntime}</script>`);
      return (await page.evaluate(script)) as T;
    } finally {
      await page.close();
    }
  }
};

afterAll(async () => {
  await browser?.close();
});

describe('glPass', () => {
  const invert = { id: 'fx-1', name: 'invert', version: 1, frag: 'vec4 effect(vec2 uv) { vec4 c = texture2D(u_src, uv); return vec4(1.0 - c.rgb, c.a); }', params: [], check: { state: 'passed' as const, problems: [], costMs: 1 } };
  const step = { id: 'custom' as const, ref: 'fx-1', params: {}, enabled: true };

  it('draws a custom step on the server through the GL page', async () => {
    const out = await glPass(playwrightGl, [invert])(grey(), step);

    expect([...out.data.slice(0, 4)]).toEqual([155, 155, 155, 255]);
  }, 30_000);

  it('leaves the pixels as they are without a GL page or for a failed effect', async () => {
    expect((await glPass(null, [invert])(grey(), step)).data[0]).toBe(100);
    expect((await glPass(playwrightGl, [{ ...invert, check: { ...invert.check, state: 'failed' as const } }])(grey(), step)).data[0]).toBe(100);
  });
});
