import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPENROUTER_UPSCALE_MODEL } from '$lib/video-models';

const toolScope = vi.fn(async (_event: unknown, chosen: string | null = null) => ({ db: fakeDb, orgId: 'org', projectId: chosen ?? 'p1', userId: 'u1' }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope }));

const gate = vi.fn(async () => undefined as undefined | { status: number; data: { message: string } });
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiActionForForm: gate }));
vi.mock('$lib/server/credits', () => ({ orgCreditBalance: vi.fn(async () => 500) }));

const PRICING = { cents_per_megapixel_second_precise: '7.5', cents_per_megapixel_second_creative: '10.5' };
const fakeDb = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: table === 'ai_models' ? { pricing: PRICING } : null, error: null }) })
      })
    })
  })
};

const assets = [
  { id: 'v1', projectId: 'p1', type: 'video', url: 'org/p1/a.mp4', mimeType: 'video/mp4', bytes: 1000, width: null, height: null, durationS: 2, source: 'upload', createdAt: '2026-10-04' },
  { id: 'i1', projectId: 'p1', type: 'image', url: 'org/p1/a.png', mimeType: 'image/png', bytes: 10, width: 1, height: 1, durationS: null, source: 'upload', createdAt: '2026-10-04' }
];
vi.mock('$lib/server/repos/assets', () => ({ listProjectAssets: vi.fn(async () => assets), findAsset: vi.fn() }));

vi.mock('$lib/server/studio/studio-media', () => ({ signedAssets: vi.fn(async () => ({ assets: new Map(), urls: { v1: 'https://signed/v1' } })) }));

const upscaleNode = { id: 'n-up', canvasId: 'c-up', projectId: 'p1', type: 'video', data: { model: OPENROUTER_UPSCALE_MODEL, running: false, refId: 'out-1', error: null, params: { upscale_factor: 2 } }, version: 3 };
vi.mock('$lib/server/repos/canvas', () => ({
  findNode: vi.fn(async () => upscaleNode),
  listConnections: vi.fn(async () => [{ id: 'e1', canvasId: 'c-up', sourceNodeId: 'n-src', targetNodeId: 'n-up' }]),
  listNodes: vi.fn(async () => [{ id: 'n-src', type: 'video', data: { assetId: 'v1' } }, upscaleNode])
}));

const startUpscale = vi.fn(async () => ({ ok: true, canvasId: 'c-up', nodeId: 'n-up' }) as { ok: boolean; canvasId?: string; nodeId?: string; error?: string });
vi.mock('$lib/server/upscale/start', () => ({ startUpscale, UPSCALE_START_DEPS: {} }));

const { load, actions } = await import('./+page.server');

function form(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return new Request('http://x/app/upscale', { method: 'POST', body });
}

async function thrown(run: () => unknown): Promise<{ status?: number; location?: string }> {
  try {
    await run();
  } catch (e) {
    return e as { status: number; location: string };
  }
  return {};
}

const START = { project: 'p1', source: 'upload', path: 'org/p1/x.mp4', file_name: 'x.mp4', mime_type: 'video/mp4', bytes: '1000', width: '854', height: '480', seconds: '2', target: '2x', mode: 'precise' };

describe('/app/upscale', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the catalogue rate, the limits and the project videos to pick from', async () => {
    const data = (await load({ url: new URL('http://x/app/upscale') } as never)) as Record<string, any>;

    expect(data.pricing).toEqual(PRICING);
    expect(data.limits.maxInputSeconds).toBe(20);
    expect(data.library.map((v: { id: string }) => v.id)).toEqual(['v1']);
    expect(data.job).toBeNull();
  });

  it('a job shows the source and the result as canvas asset links', async () => {
    const data = (await load({ url: new URL('http://x/app/upscale?project=p1&job=n-up') } as never)) as Record<string, any>;

    expect(data.job).toMatchObject({
      status: 'done',
      beforeUrl: '/p/p1/c/c-up/assets/v1',
      afterUrl: '/p/p1/c/c-up/assets/out-1',
      canvasHref: '/p/p1/c/c-up'
    });
  });

  it('start runs the upscale and opens its job', async () => {
    const redirected = await thrown(() => actions.start({ request: form(START), url: new URL('http://x/app/upscale') } as never));

    expect(startUpscale).toHaveBeenCalledWith(
      fakeDb,
      {},
      expect.objectContaining({
        orgId: 'org',
        projectId: 'p1',
        source: { kind: 'upload', path: 'org/p1/x.mp4', fileName: 'x.mp4', mimeType: 'video/mp4', bytes: 1000 },
        probe: { width: 854, height: 480, seconds: 2 },
        target: '2x',
        mode: 'precise'
      })
    );
    expect(redirected).toMatchObject({ status: 303, location: '/app/upscale?project=p1&job=n-up' });
  });

  it('without credits nothing starts', async () => {
    gate.mockResolvedValueOnce({ status: 402, data: { message: 'Out of credits' } });

    const refused = (await actions.start({ request: form(START), url: new URL('http://x/app/upscale') } as never)) as { status: number; data: { error: string } };

    expect(refused.status).toBe(402);
    expect(startUpscale).not.toHaveBeenCalled();
  });

  it('a refusal is said in words', async () => {
    startUpscale.mockResolvedValueOnce({ ok: false, error: 'too_long' });

    const refused = (await actions.start({ request: form(START), url: new URL('http://x/app/upscale') } as never)) as { status: number; data: { error: string } };

    expect(refused.status).toBe(422);
    expect(refused.data.error).toMatch(/20 seconds/);
  });
});
