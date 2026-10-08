import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = 'org-1';
const NODE = '11111111-2222-4333-8444-555555555555';

const store = vi.hoisted(() => ({
  caller: null as null | Record<string, unknown>,
  head: 2 as number | null,
  open: true,
  seeks: [] as number[],
  viewport: null as null | { width: number; height: number; scale: number }
}));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => (store.caller ? { caller: store.caller } : { error: { status: 401, body: { error: 'unauthenticated' } } }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE
      ? { id: NODE, projectId: 'p-1', canvasId: 'c-1', type: 'motion', displayName: 'Launch', data: { format: '16:9', docHeadRevision: store.head ?? 0, posterAssetId: null, lastRenderAssetId: null } }
      : null
}));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async () => ({ id: 'p-1', brandId: null, mode: 'standard' }) }));
vi.mock('$lib/server/repos/assets', () => ({ listProjectAssets: async () => [] }));
vi.mock('$lib/server/canvas/sign-media', () => ({ createAssetSigningDb: () => ({}), signAssetPaths: async () => new Map() }));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/motion-revisions')>()),
  readHead: async () => {
    if (!store.head) {
      return null;
    }
    const { newMotionDoc, MotionFormat } = await import('$lib/motion/doc');
    return { version: store.head, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actorKind: 'user' };
  }
}));
vi.mock('$lib/server/motion/frame-stats', () => ({ frameStats: async (frames: { time: number }[]) => frames.map((f) => ({ time: f.time, luma: 100, lumaStd: 30, whiteShare: 0 })) }));
vi.mock('$lib/server/motion/chromium-frames', () => ({
  serverFramesOpen: () => store.open,
  chromiumFrames: {
    open: async (viewport: { width: number; height: number; scale: number }) => {
      store.viewport = viewport;
      return {
        load: async () => {},
        seek: async (t: number) => {
          store.seeks.push(t);
        },
        jpeg: async () => Buffer.from([0xff, 0xd8, 0xff]),
        close: async () => {}
      };
    }
  }
}));

const { POST } = await import('./+server');
const { resetFrameLimits } = await import('$lib/server/motion/agent-frames');

const call = (body: unknown, org = ORG) => {
  const url = new URL(`https://feega.app/api/v1/motion/${NODE}/frames`);
  return POST({ request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer k' }, body: JSON.stringify(body) }), params: { nodeId: NODE }, url } as never);
};

beforeEach(() => {
  store.caller = { db: {}, orgId: ORG, userId: 'u-1', apiKeyId: 'key-1', writeAllowed: false };
  store.head = 2;
  store.open = true;
  store.seeks = [];
  store.viewport = null;
  resetFrameLimits();
});

describe('POST /api/v1/motion/[nodeId]/frames', () => {
  it('draws the saved video at the asked times and returns inline jpegs plus the quality gate', async () => {
    const res = await call({ times: [0.5, 2], width: 480 });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(store.seeks).toEqual([0.5, 2]);
    expect(store.viewport).toEqual({ width: 1920, height: 1080, scale: 0.25 });
    expect(body.frames.map((f: { time: number }) => f.time)).toEqual([0.5, 2]);
    expect(body.frames[0]).toMatchObject({ mime: 'image/jpeg', data: Buffer.from([0xff, 0xd8, 0xff]).toString('base64') });
    expect(Array.isArray(body.quality)).toBe(true);
    expect(Array.isArray(body.blocking)).toBe(true);
    expect(body.revision).toBe(2);
  });

  it('works with a read-only key: looking spends nothing and changes nothing', async () => {
    expect((await call({ times: [1] })).status).toBe(200);
  });

  it('refuses without auth', async () => {
    store.caller = null;
    expect((await call({ times: [1] })).status).toBe(401);
  });

  it('does not see a node of another org', async () => {
    store.caller = { ...store.caller, orgId: 'org-2' };
    expect((await call({ times: [1] })).status).toBe(404);
    expect(store.seeks).toEqual([]);
  });

  it.each([
    ['no times', { times: [] }],
    ['more than six', { times: [0, 1, 2, 3, 4, 5, 6] }],
    ['a negative time', { times: [-1] }],
    ['a time past the end', { times: [999] }],
    ['a width past the cap', { times: [1], width: 4000 }]
  ])('refuses %s before drawing anything', async (_name, body) => {
    const res = await call(body);
    expect(res.status).toBe(400);
    expect(store.seeks).toEqual([]);
  });

  it('refuses an empty video', async () => {
    store.head = null;
    expect((await call({ times: [1] })).status).toBe(409);
  });

  it('says so when this deployment cannot draw frames', async () => {
    store.open = false;
    expect((await call({ times: [1] })).status).toBe(503);
  });

  it('rate-limits each org', async () => {
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await call({ times: [1] })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
