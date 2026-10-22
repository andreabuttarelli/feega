import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { diffDoc } from '$lib/motion/doc-ops';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
const lookupFound = () => ({ orgId: 'org-a', canvas: { id: 'c1', projectId: 'p1', name: 'C' }, projectBrandId: null });
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => lookupFound(), openCanvasForUser: async () => ({ memberships: [], found: lookupFound() }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/repos/canvas', async (real) => ({ ...(await real<object>()), patchNodeData: vi.fn(async () => ({ ok: true })) }));
vi.mock('$lib/server/motion/editor', async (original) => ({
  ...(await original<object>()),
  findMotionNode: async () => ({ record: { id: 'n1' }, node: { format: 'landscape' } })
}));

const { actions } = await import('$lib/server/frame-editor/editor-page');

const SCOPE = { orgId: 'org-a', nodeId: 'n1' };
const user = { kind: 'user' as const, id: 'u1' };

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const start = () => must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'a' } }, 'a')), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'b' } }, 'b'));

const retext = (doc: MotionDoc, id: string, text: string): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, text } } : c)) }))
});

function event(db: unknown, fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    form.set(k, v);
  }
  return {
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => db },
    params: { projectId: 'p1', canvasId: 'c1', nodeId: 'n1' },
    request: new Request('http://x', { method: 'POST', body: form })
  } as never;
}

async function seeded() {
  const store = revisionsDb();
  await appendRevision(store.db, { ...SCOPE, expectedVersion: 0, doc: start(), actor: user });
  return store;
}

const opsOf = (doc: MotionDoc) => JSON.stringify(diffDoc(start(), doc));

describe('the editor sends its edits as ops', () => {
  it('two editors on the same base both land, with no conflict', async () => {
    const { db } = await seeded();

    const first = (await actions.ops(event(db, { version: '1', ops: opsOf(retext(start(), 'a', 'from ana')), summary: 'Ana' }))) as Record<string, unknown>;
    const second = (await actions.ops(event(db, { version: '1', ops: opsOf(retext(start(), 'b', 'from bo')), summary: 'Bo' }))) as { version: number; doc: MotionDoc; rebased: boolean };

    expect(first).toMatchObject({ version: 2, rebased: false });
    expect(second).toMatchObject({ version: 3, rebased: true });
    expect(findClip(second.doc, 'a')?.clip.props.text).toBe('from ana');
    const head = await readHead(db, SCOPE);
    expect([findClip(head!.doc, 'a')?.clip.props.text, findClip(head!.doc, 'b')?.clip.props.text]).toEqual(['from ana', 'from bo']);
  });

  it('ops that are not a list are refused', async () => {
    const { db, rows } = await seeded();

    const out = (await actions.ops(event(db, { version: '1', ops: '{"kind":"nope"}' }))) as { status?: number };

    expect(out.status).toBe(400);
    expect(rows).toHaveLength(1);
  });

  it('an open editor reads the head another writer left', async () => {
    const { db } = await seeded();
    await actions.ops(event(db, { version: '1', ops: opsOf(retext(start(), 'a', 'from the agent')), summary: 'Agent' }));

    const out = (await actions.head(event(db, {}))) as { version: number; doc: MotionDoc };

    expect(out.version).toBe(2);
    expect(findClip(out.doc, 'a')?.clip.props.text).toBe('from the agent');
  });
});
