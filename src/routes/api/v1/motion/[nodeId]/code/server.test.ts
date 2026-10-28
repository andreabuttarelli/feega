import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { appendRevision } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';
import { featureGridDoc } from '@feega/motion-core/motion/codegen/fixtures/small';

const ORG = 'org-1';
const NODE = 'node-1';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.db, orgId: ORG, userId: 'u-1', writeAllowed: false } }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE ? { id: NODE, canvasId: 'c-1', projectId: 'p-1', type: 'motion', displayName: 'Features', data: {}, version: 1 } : null
}));
vi.mock('$lib/server/repos/projects', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/projects')>()), findProjectById: async () => null }));
vi.mock('$lib/server/motion/editor', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/motion/editor')>()), assetsById: async () => ({}), motionTokens: async () => FEEGA_TOKENS }));

const { GET } = await import('./+server');

const call = (nodeId: string, target?: string) => {
  const url = new URL(`https://feega.test/api/v1/motion/${nodeId}/code${target ? `?target=${target}` : ''}`);
  return GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), params: { nodeId }, url } as never);
};

beforeEach(async () => {
  const fake = revisionsDb();
  state.db = fake.db;
  await appendRevision(fake.db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: featureGridDoc(), actor: { kind: 'user', id: 'u-1' }, summary: 'grid' });
});

describe('/api/v1/motion/[nodeId]/code', () => {
  it('returns the frame as a React project by default, with a read-only key', async () => {
    const res = await call(NODE);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ name: 'Features', target: 'react' });
    expect(body.files.map((f: { path: string }) => f.path)).toContain('src/components/FeatureCard.tsx');
  });

  it('takes the target from the query', async () => {
    const body = await (await call(NODE, 'svelte')).json();

    expect(body.files.map((f: { path: string }) => f.path)).toContain('src/lib/components/FeatureCard.svelte');
  });

  it('refuses an unknown target and a node it cannot see', async () => {
    expect((await call(NODE, 'vue')).status).toBe(400);
    expect((await call('other')).status).toBe(404);
  });
});
