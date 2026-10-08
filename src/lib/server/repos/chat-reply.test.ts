import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { fakeDb, type Call } from '$lib/server/db/fake-db';
import { agentActor } from '$lib/server/repos/actor';
import { forgetReplySchema, openReply, ReplyStatus } from './chat-reply';

const ORG = '11111111-1111-1111-1111-111111111111';
const THREAD = '44444444-4444-4444-4444-444444444444';
const TOOL = { toolCallId: 'c1', toolName: 'list_nodes', status: 'done' as const, input: {}, output: { n: 1 } };
const MISSING_COLUMN = { code: 'PGRST204', message: "Could not find the 'status' column of 'chat_messages' in the schema cache" };

const scope = { orgId: ORG, threadId: THREAD, actor: agentActor('u-1') };

function withoutStatusColumn(): { db: Db; calls: Call[] } {
  const { db, calls } = fakeDb({ chat_messages: [{ seq: 2 }] });
  const from = db.from.bind(db);
  const patched = {
    from: (table: string) => {
      const real = from(table as never) as unknown as Record<string, (p?: unknown) => unknown>;
      return {
        ...real,
        insert: (payload: Record<string, unknown>) => {
          if (!('status' in payload)) {
            return real.insert(payload);
          }
          calls.push({ table, op: 'insert-refused', payload, filters: [] });
          const refused = { data: null, error: MISSING_COLUMN };
          const chain = { select: () => chain, single: async () => refused, then: (r: (v: unknown) => unknown) => r(refused) };
          return chain;
        }
      };
    }
  } as unknown as Db;
  return { db: patched, calls };
}

const writes = (calls: Call[]) => calls.filter((c) => c.op === 'update').map((c) => c.payload as Record<string, unknown>);

describe('openReply — the answer is written while it is made', () => {
  beforeEach(() => forgetReplySchema());

  it('opens a streaming assistant row before the first step, after the last message', async () => {
    const { db, calls } = fakeDb({ chat_messages: [{ seq: 7 }] });

    await openReply(db, scope);

    expect(calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ org_id: ORG, thread_id: THREAD, role: 'assistant', content: '', status: ReplyStatus.Streaming, seq: 8, actor_kind: 'agent' });
  });

  it('each step rewrites the same row with the text and tools so far, still streaming', async () => {
    const { db, calls } = fakeDb({ chat_messages: [] });
    const reply = await openReply(db, scope);

    await reply.progress({ content: 'Looking', tools: [] });
    await reply.progress({ content: 'Looking at the canvas', tools: [TOOL] });

    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(1);
    expect(writes(calls)).toEqual([
      expect.objectContaining({ content: 'Looking', status: ReplyStatus.Streaming }),
      expect.objectContaining({ content: 'Looking at the canvas', tool_calls: [TOOL], status: ReplyStatus.Streaming })
    ]);
    expect(calls.filter((c) => c.op === 'update').every((c) => c.filters.some(([k, v]) => k === 'id' && v === 'generated-id'))).toBe(true);
  });

  it('a finished turn leaves the row done', async () => {
    const { db, calls } = fakeDb({ chat_messages: [] });
    const reply = await openReply(db, scope);

    await reply.finish({ content: 'Made it.', tools: [] }, ReplyStatus.Done);

    expect(writes(calls).at(-1)).toMatchObject({ content: 'Made it.', status: ReplyStatus.Done });
  });

  it('a turn that broke keeps what it did and says failed, and the first ending wins', async () => {
    const { db, calls } = fakeDb({ chat_messages: [] });
    const reply = await openReply(db, scope);

    await reply.finish({ content: 'Half', tools: [TOOL] }, ReplyStatus.Failed);
    await reply.finish({ content: '', tools: [] }, ReplyStatus.Done);
    await reply.progress({ content: 'late', tools: [] });

    expect(writes(calls)).toEqual([expect.objectContaining({ content: 'Half', status: ReplyStatus.Failed })]);
  });

  it('without the status column it saves the answer once at the end, as before the migration', async () => {
    const { db, calls } = withoutStatusColumn();
    const reply = await openReply(db, scope);

    await reply.progress({ content: 'Looking', tools: [] });
    await reply.finish({ content: 'Made it.', tools: [TOOL] }, ReplyStatus.Done);

    const inserts = calls.filter((c) => c.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toMatchObject({ role: 'assistant', content: 'Made it.', seq: 3 });
    expect(inserts[0].payload).not.toHaveProperty('status');
    expect(writes(calls)).toEqual([]);
  });

  it('learns the column is missing once, then stops asking', async () => {
    const { db, calls } = withoutStatusColumn();

    await openReply(db, scope);
    await openReply(db, scope);

    expect(calls.filter((c) => c.op === 'insert-refused')).toHaveLength(1);
  });
});
