import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { diffDoc } from '$lib/motion/doc-ops';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';

const { USER, current } = vi.hoisted(() => ({ USER: { id: 'u1', email: 'ada@x.it' }, current: { db: null as unknown } }));

vi.mock('$lib/server/db/client', () => ({ createUserDb: () => current.db }));
vi.mock('$lib/server/nav-cache', () => ({ verifiedToken: async (_db: unknown, token: string) => (token === 'jwt' ? USER : null) }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
const lookupFound = () => ({ orgId: 'org-a', canvas: { id: 'c1', projectId: 'p1', name: 'C' }, projectBrandId: null });
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => lookupFound(), openCanvasForUser: async () => ({ memberships: [], found: lookupFound() }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/repos/canvas', async (real) => ({ ...(await real<object>()), patchNodeData: vi.fn(async () => ({ ok: true })) }));
vi.mock('$lib/server/motion/editor', async (original) => ({
  ...(await original<object>()),
  findMotionNode: async () => ({ record: { id: 'n1' }, node: { format: 'landscape' } })
}));

const { POST } = await import('./+server');

const SCOPE = { orgId: 'org-a', nodeId: 'n1' };
const params = { projectId: 'p1', canvasId: 'c1', nodeId: 'n1' };

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const start = () => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'a' } }, 'a'));
const retexted = (text: string): MotionDoc => ({ ...start(), tracks: start().tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, props: { ...c.props, text } })) })) });

async function seeded() {
  const store = revisionsDb();
  current.db = store.db;
  await appendRevision(store.db, { ...SCOPE, expectedVersion: 0, doc: start(), actor: { kind: 'user', id: 'u1' } });
  return store;
}

async function post(action: string, fields: Record<string, string>, token = 'jwt') {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  const url = new URL(`http://x/api/v1/projects/p1/canvases/c1/motion/n1?action=${action}`);
  const request = new Request(url, { method: 'POST', body: form, headers: { authorization: `Bearer ${token}` } });
  const res = await POST({ request, url, params } as never);
  return { status: res.status, body: await res.json() };
}

describe('the frame editor page over bearer', () => {
  it('runs the page ops action as the user and lands the edit', async () => {
    const store = await seeded();

    const answer = await post('ops', { version: '1', ops: JSON.stringify(diffDoc(start(), retexted('over bearer'))), summary: 's' });

    expect(answer).toMatchObject({ status: 200, body: { version: 2 } });
    const head = await readHead(store.db, SCOPE);
    expect(findClip(head!.doc, 'a')?.clip.props.text).toBe('over bearer');
  });

  it('a refusal keeps its status', async () => {
    await seeded();

    expect((await post('ops', { version: '1', ops: '{"kind":"nope"}' })).status).toBe(400);
  });

  it('an unknown action is not found, a bad token is unauthorized', async () => {
    expect((await post('nope', {})).status).toBe(404);
    expect(await post('ops', {}, 'bad')).toEqual({ status: 401, body: { error: 'invalid_token' } });
  });
});
