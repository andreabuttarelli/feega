import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OUT_OF_REACH } from '$lib/server/org-data/reach';

const ORG = 'org-1';
const LOCKED_PROJECT = 'p-locked';
const LOCKED_NODE = 'n-locked';
const LOCKED_RUN = 'r-locked';
const LOCKED_ASSET = 'a-locked';

const NOTHING = { projectIds: [] as string[], canvasIds: [] as string[], nodeIds: [] as string[] };
const LOCKED = { projectIds: [LOCKED_PROJECT], canvasIds: ['c-locked'], nodeIds: [LOCKED_NODE] };

const state = vi.hoisted(() => ({ hidden: null as unknown }));

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: async () => ({ caller: { db: {}, orgId: ORG, userId: 'u-1', writeAllowed: true } })
}));
vi.mock('$lib/server/uncensored-workspace/hidden-scope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/uncensored-workspace/hidden-scope')>()),
  hiddenFor: async () => state.hidden
}));
vi.mock('$lib/server/repos/node-runs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/node-runs')>()),
  runsByIds: async (_db: unknown, input: { ids: string[] }) => input.ids.filter((id) => id === LOCKED_RUN).map((id) => ({ id, orgId: ORG, nodeId: LOCKED_NODE, params: {} }))
}));
vi.mock('$lib/server/repos/assets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/assets')>()),
  findAssets: async (_db: unknown, input: { assetIds: string[] }) =>
    new Map(input.assetIds.filter((id) => id === LOCKED_ASSET).map((id) => [id, { id, projectId: LOCKED_PROJECT }]))
}));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === LOCKED_NODE
      ? { id: LOCKED_NODE, canvasId: 'c-locked', projectId: LOCKED_PROJECT, type: 'motion', displayName: 'Locked', data: {}, version: 1 }
      : null
}));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/motion-revisions')>()),
  readHead: async () => null
}));

type Handler = (event: unknown) => Promise<Response>;
type Case = { name: string; load: () => Promise<Record<string, unknown>>; method: string; path: string; params: Record<string, string>; body?: unknown };

const node = { nodeId: LOCKED_NODE };

const CASES: Case[] = [
  { name: 'motion summary', load: () => import('./motion/[nodeId]/+server'), method: 'GET', path: `motion/${LOCKED_NODE}`, params: node },
  { name: 'revisions GET', load: () => import('./motion/[nodeId]/revisions/+server'), method: 'GET', path: 'revisions', params: node },
  { name: 'revisions POST', load: () => import('./motion/[nodeId]/revisions/+server'), method: 'POST', path: 'revisions', params: node, body: { version: 1 } },
  { name: 'render', load: () => import('./motion/[nodeId]/render/+server'), method: 'POST', path: 'render', params: node, body: {} },
  { name: 'tools', load: () => import('./motion/[nodeId]/tools/+server'), method: 'POST', path: 'tools', params: node, body: { tool: 'x', input: {} } },
  { name: 'frames', load: () => import('./motion/[nodeId]/frames/+server'), method: 'POST', path: 'frames', params: node, body: {} },
  { name: 'templates', load: () => import('./motion/[nodeId]/templates/+server'), method: 'POST', path: 'templates', params: node, body: {} },
  { name: 'embed GET', load: () => import('./motion/[nodeId]/embed/+server'), method: 'GET', path: 'embed', params: node },
  { name: 'embed POST', load: () => import('./motion/[nodeId]/embed/+server'), method: 'POST', path: 'embed', params: node, body: {} },
  { name: 'embed DELETE', load: () => import('./motion/[nodeId]/embed/+server'), method: 'DELETE', path: 'embed', params: node },
  { name: 'embed bundle', load: () => import('./motion/[nodeId]/embed/bundle/+server'), method: 'GET', path: 'bundle', params: node },
  { name: 'ask', load: () => import('./motion/[nodeId]/ask/+server'), method: 'POST', path: 'ask', params: node, body: { prompt: 'hi' } },
  { name: 'storyboard GET', load: () => import('./motion/[nodeId]/storyboard/+server'), method: 'GET', path: 'storyboard', params: node },
  { name: 'storyboard POST', load: () => import('./motion/[nodeId]/storyboard/+server'), method: 'POST', path: 'storyboard', params: node, body: {} },
  { name: 'storyboard PATCH', load: () => import('./motion/[nodeId]/storyboard/+server'), method: 'PATCH', path: 'storyboard', params: node, body: {} },
  { name: 'budget GET', load: () => import('./motion/[nodeId]/budget/+server'), method: 'GET', path: 'budget', params: node },
  { name: 'budget POST', load: () => import('./motion/[nodeId]/budget/+server'), method: 'POST', path: 'budget', params: node },
  { name: 'ask run status', load: () => import('./motion/runs/[runId]/+server'), method: 'GET', path: 'runs', params: { runId: LOCKED_RUN } },
  { name: 'render status', load: () => import('./motion/renders/[runId]/+server'), method: 'GET', path: 'renders', params: { runId: LOCKED_RUN } },
  { name: 'motion list of a locked project', load: () => import('./motion/+server'), method: 'GET', path: `motion?project=${LOCKED_PROJECT}`, params: {} },
  { name: 'from-template into a locked project', load: () => import('./motion/from-template/+server'), method: 'POST', path: 'from-template', params: {}, body: { project: LOCKED_PROJECT, template: 't', format: 'square' } },
  { name: 'elements', load: () => import('./motion/elements/+server'), method: 'POST', path: 'elements', params: {}, body: { node_id: LOCKED_NODE } },
  { name: 'generate (run_node_generation)', load: () => import('./org/nodes/[id]/generate/+server'), method: 'POST', path: 'generate', params: { id: LOCKED_NODE }, body: { medium: 'motion' } },
  { name: 'loop GET', load: () => import('./org/nodes/[id]/loop/+server'), method: 'GET', path: 'loop', params: { id: LOCKED_NODE } },
  { name: 'loop POST', load: () => import('./org/nodes/[id]/loop/+server'), method: 'POST', path: 'loop', params: { id: LOCKED_NODE }, body: {} },
  { name: 'loop DELETE', load: () => import('./org/nodes/[id]/loop/+server'), method: 'DELETE', path: 'loop', params: { id: LOCKED_NODE } },
  { name: 'apply-effects', load: () => import('./org/nodes/[id]/apply-effects/+server'), method: 'POST', path: 'apply-effects', params: { id: LOCKED_NODE }, body: { effects: [] } },
  { name: 'effects-pair', load: () => import('./org/nodes/[id]/effects-pair/+server'), method: 'POST', path: 'effects-pair', params: { id: LOCKED_NODE } },
  { name: 'media by node', load: () => import('./org/media/+server'), method: 'GET', path: `media?node=${LOCKED_NODE}`, params: {} },
  { name: 'media by run', load: () => import('./org/media/+server'), method: 'GET', path: `media?run=${LOCKED_RUN}`, params: {} },
  { name: 'media by asset', load: () => import('./org/media/+server'), method: 'GET', path: `media?asset=${LOCKED_ASSET}`, params: {} },
  { name: 'gallery remix into a locked project', load: () => import('./gallery/[id]/remix/+server'), method: 'POST', path: 'remix', params: { id: 'g-1' }, body: { project_id: LOCKED_PROJECT } },
  { name: 'gallery publish', load: () => import('./gallery/publish/+server'), method: 'POST', path: 'publish', params: {}, body: { node_id: LOCKED_NODE, title: 'x' } }
];

async function hit(c: Case): Promise<Response> {
  const handler = (await c.load())[c.method] as Handler;
  const url = new URL(`https://feega.test/api/v1/${c.path}`);
  const body = c.body === undefined ? undefined : JSON.stringify(c.body);
  const request = new Request(url, { method: c.method, headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body });
  return handler({ request, params: c.params, url, locals: {}, fetch, getClientAddress: () => '127.0.0.1' });
}

beforeEach(() => {
  state.hidden = LOCKED;
});

describe('a member without uncensored access cannot reach a locked project', () => {
  it.each(CASES)('$name answers 404, the same as a node that does not exist', async (c) => {
    const res = await hit(c);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: OUT_OF_REACH });
  });

  it('the same member reads the same video once the project is open to them', async () => {
    state.hidden = NOTHING;

    const res = await hit(CASES[0]);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ node_id: LOCKED_NODE });
  });
});
