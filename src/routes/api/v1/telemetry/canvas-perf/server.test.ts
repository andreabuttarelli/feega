import { beforeEach, describe, expect, it, vi } from 'vitest';

const { track } = vi.hoisted(() => ({ track: vi.fn(async (..._args: unknown[]) => undefined) }));
vi.mock('$lib/server/product-events/track', async (actual) => ({ ...(await actual<object>()), track }));

const { POST } = await import('./+server');
const { ProductEvent } = await import('$lib/server/product-events/track');
const { SUMMARIES_PER_USER_PER_HOUR } = await import('$lib/server/canvas-perf');

let nextUser = 0;
const signedIn = (id: string) => ({ safeGetSession: async () => ({ user: { id } }) });

const post = (body: string, locals: unknown = signedIn(`u${nextUser++}`)) => POST({ request: new Request('https://feega.test/api/v1/telemetry/canvas-perf', { method: 'POST', body }), locals } as never);

const SUMMARY = {
  v: 1,
  sessionId: 's1',
  canvasId: 'c1',
  device: 'phone',
  dpr: 3,
  cores: 6,
  memoryGb: 4,
  coreVersion: 'abc123',
  frames: 4,
  nodes: 20,
  docBytes: 1000,
  heapMb: null,
  sessionMs: 60000,
  backend: 'webgl',
  fallbacks: 1,
  deviceLost: 0,
  load: { firstContent: 400, allFrames: 900, sharp: 1500 },
  gestures: { pan: { frames: 100, over: 0.1, p95: 14, p99: 30, longTasks: 1 } },
  longTasks: { count: 2, ms: 140 },
  edit: { n: 3, p50: 40, p95: 90 }
};

describe('a canvas perf summary', () => {
  beforeEach(() => track.mockClear());

  it('is recorded as one canvas_perf event under the user', async () => {
    const res = await post(JSON.stringify(SUMMARY), signedIn('alice'));

    expect(res.status).toBe(204);
    expect(track).toHaveBeenCalledWith(ProductEvent.CanvasPerf, { userId: 'alice' }, SUMMARY);
  });

  it('drops keys it does not know and text that is not an id', async () => {
    await post(JSON.stringify({ ...SUMMARY, prompt: 'make a logo', backend: 'x'.repeat(200), gestures: { pan: { frames: 1, note: 'hi' }, spin: { frames: 2 } } }));

    const props = track.mock.calls[0][2] as Record<string, unknown>;
    expect(props).not.toHaveProperty('prompt');
    expect(props).not.toHaveProperty('backend');
    expect(props.gestures).toEqual({ pan: { frames: 1 } });
  });

  it('refuses a summary of another version or not a record', async () => {
    expect((await post(JSON.stringify({ ...SUMMARY, v: 99 }))).status).toBe(400);
    expect((await post('[1]'))).toHaveProperty('status', 400);
    expect((await post('nope')).status).toBe(400);
    expect(track).not.toHaveBeenCalled();
  });

  it('refuses an oversized body', async () => {
    expect((await post(JSON.stringify({ ...SUMMARY, canvasId: 'x'.repeat(20_000) }))).status).toBe(413);
  });

  it('refuses a caller with no session', async () => {
    expect((await post(JSON.stringify(SUMMARY), { safeGetSession: async () => ({ user: null }) })).status).toBe(401);
    expect(track).not.toHaveBeenCalled();
  });

  it('refuses a user past the hourly limit', async () => {
    const locals = signedIn('chatty');
    for (let i = 0; i < SUMMARIES_PER_USER_PER_HOUR; i++) {
      expect((await post(JSON.stringify(SUMMARY), locals)).status).toBe(204);
    }

    expect((await post(JSON.stringify(SUMMARY), locals)).status).toBe(429);
  });
});
