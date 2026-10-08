import { describe, expect, it } from 'vitest';
import { RenderQueue } from '$lib/motion/server-render';
import { Build, renderQueue } from './render-queue';

describe('whether a tick drives the render queue', () => {
  it('a dev server without DEV_CRONS has no tick: renders never advance', () => {
    expect(renderQueue(Build.Dev, {})).toBe(RenderQueue.Stopped);
    expect(renderQueue(Build.Dev, { DEV_CRONS: '0' })).toBe(RenderQueue.Stopped);
  });

  it('a dev server with DEV_CRONS ticks like production', () => {
    expect(renderQueue(Build.Dev, { DEV_CRONS: '1' })).toBe(RenderQueue.Ticking);
  });

  it('production is driven by the Vercel cron whatever the env says', () => {
    expect(renderQueue(Build.Production, {})).toBe(RenderQueue.Ticking);
  });
});
