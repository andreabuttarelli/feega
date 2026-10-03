import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { LAMBDA_ENV, RENDER_NOT_CONFIGURED, motionRenderer } from './renderer';

const job = { html: '<html></html>', width: 1080, height: 1920, fps: 30, durationInFrames: 450 };

describe('motion renderer', () => {
  it('without AWS settings it is not configured and refuses to start', async () => {
    const renderer = motionRenderer({});

    expect(renderer.configured).toBe(false);
    expect(await renderer.start(job)).toEqual({ ok: false, error: RENDER_NOT_CONFIGURED });
  });

  it('one missing setting is the same as none', () => {
    const partial = Object.fromEntries(LAMBDA_ENV.slice(1).map((k) => [k, 'x']));

    expect(motionRenderer(partial).configured).toBe(false);
  });

  it('every setting present makes it configured', () => {
    expect(motionRenderer(Object.fromEntries(LAMBDA_ENV.map((k) => [k, 'x']))).configured).toBe(true);
  });
});
