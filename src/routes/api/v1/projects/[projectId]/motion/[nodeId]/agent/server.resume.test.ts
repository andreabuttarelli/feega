import { describe, it, expect, vi } from 'vitest';
import { fakeDb, type Call } from '$lib/server/db/fake-db';
import { DOC_EDITED } from '$lib/motion/frames-request';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';

const world = vi.hoisted(() => ({ db: null as unknown, stored: new Map<string, string>() }));

vi.mock('$lib/server/motion/agent-scope', () => ({
  motionAgentScope: async () => ({ db: world.db, user: { id: 'u-1' }, orgId: 'org-1', project: { id: 'p-1', brandId: null }, motion: { record: { id: 'n-1' }, node: {} } })
}));
vi.mock('$lib/server/motion/editor', () => ({
  headOrNew: async () => ({ version: 3, doc: newMotionDoc(MotionFormat.Landscape), summary: null, actorKind: 'user' })
}));

const { GET, DELETE } = await import('./+server');

const WORKING = 'org-1/p-1/motion-drafts/n-1.json';
const ago = (s: number) => new Date(Date.now() - s * 1000).toISOString();

function serverWith(messages: Record<string, unknown>[]): Call[] {
  const { db, calls } = fakeDb({ chat_threads: [{ id: 't-1' }], chat_messages: messages });
  const storage = { from: () => ({ download: async (path: string) => ({ data: world.stored.has(path) ? new Blob([world.stored.get(path)!]) : null, error: null }) }) };
  world.db = { from: db.from, storage };
  return calls;
}

const event = () => ({ params: { projectId: 'p-1', nodeId: 'n-1' }, locals: {} }) as unknown as Parameters<typeof GET>[0];

describe('the motion agent after a reload mid-turn', () => {
  it('a running turn hands back the agent working doc, so the editor shows its progress', async () => {
    const working = { edit: 4, doc: newMotionDoc(MotionFormat.Landscape) };
    world.stored.set(WORKING, JSON.stringify(working));
    serverWith([{ id: 'm-1', role: 'assistant', status: 'streaming', content: '', created_at: ago(30) }]);

    const body = await (await GET(event())).json();

    expect(body.running).toBe(true);
    expect(body.parts).toEqual([{ type: DOC_EDITED, data: working }]);
  });

  it('a finished turn hands back no working doc: the saved head is the truth', async () => {
    world.stored.set(WORKING, JSON.stringify({ edit: 1, doc: newMotionDoc(MotionFormat.Landscape) }));
    serverWith([{ id: 'm-1', role: 'assistant', status: 'done', content: 'ok', created_at: ago(30) }]);

    const body = await (await GET(event())).json();

    expect(body.running).toBe(false);
    expect(body.parts).toEqual([]);
  });

  it('stop closes the answer even when no server is running the turn any more', async () => {
    const calls = serverWith([{ id: 'm-1', role: 'assistant', status: 'streaming', content: '', created_at: ago(30) }]);

    const res = await DELETE(event());
    const closed = calls.find((c) => c.table === 'chat_messages' && c.op === 'update');

    expect(res.status).toBe(200);
    expect(closed?.payload).toMatchObject({ status: 'failed' });
  });
});
