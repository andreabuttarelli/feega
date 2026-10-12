import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { VIDEO_CAP_USD, VIDEO_RAISE_USD } from '$lib/server/brand-agent/limits';

const ORG = 'org-1';
const NODE = 'n-1';

const world = vi.hoisted(() => ({ caller: null as null | Record<string, unknown> }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => (world.caller ? { caller: world.caller } : { error: { status: 401, body: { error: 'missing_bearer' } } }) }));

const { GET, POST } = await import('./+server');

type Handler = (event: never) => Response | Promise<Response>;

const call = (handler: Handler, method: string) => {
  const url = new URL(`https://feega.app/api/v1/motion/${NODE}/budget`);
  return handler({ request: new Request(url, { method, headers: { authorization: 'Bearer k' } }), params: { nodeId: NODE }, url } as never);
};

const node = { id: NODE, org_id: ORG, canvas_id: 'c-1', project_id: 'p-1', type: 'motion', display_name: 'Launch', x: 0, y: 0, z: 0, width: null, height: null, version: 1, data: { format: 'vertical', docHeadRevision: 2, posterAssetId: null, lastRenderAssetId: null } };

function withVideo(writeAllowed = true) {
  const { db } = fakeDb({ nodes: [{ ...node, data: { ...node.data } }], ai_calls: [{ org_id: ORG, node_id: NODE, cost_usd: 1.5 }, { org_id: ORG, node_id: NODE, cost_usd: 0.6 }, { org_id: ORG, node_id: 'other', cost_usd: 9 }], canvas_events: [] }, { filter: true, mutate: true });
  world.caller = { db, orgId: ORG, userId: 'u-1', writeAllowed };
}

describe('the video budget over the API, as the CLI and MCP use it', () => {
  beforeEach(() => {
    world.caller = null;
  });

  it('reads what the video spent across all its turns, and its cap', async () => {
    withVideo();

    const body = await (await call(GET, 'GET')).json();

    expect(body).toEqual({ ok: true, spent_usd: 2.1, cap_usd: VIDEO_CAP_USD, raise_usd: VIDEO_RAISE_USD });
  });

  it('a raise is kept on the video: the next read sees the higher cap', async () => {
    withVideo();

    const raised = await call(POST, 'POST');
    const read = await (await call(GET, 'GET')).json();

    expect(raised.status).toBe(200);
    expect(read.cap_usd).toBe(VIDEO_CAP_USD + VIDEO_RAISE_USD);
  });

  it('a read-only key cannot raise what a video may spend', async () => {
    withVideo(false);

    expect((await call(POST, 'POST')).status).toBe(403);
  });
});
