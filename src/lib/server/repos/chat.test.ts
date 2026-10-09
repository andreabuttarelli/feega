import { describe, expect, it } from 'vitest';
import { fakeDb, filtersOf } from '$lib/server/db/fake-db';
import { agentActor, SIDEBAR_AGENT_KEY } from '$lib/server/repos/actor';
import { HISTORY_LIMIT, loadTurns, openThread, promptHistory, saveTurn, turnRunning } from './chat';
import { AGENT_STALE_MS } from '$lib/server/brand-agent/limits';
import { AttachmentKind } from '$lib/chat-attachments';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const USER = '33333333-3333-3333-3333-333333333333';
const THREAD = '44444444-4444-4444-4444-444444444444';

describe('openThread — un thread per progetto e utente, sempre dentro la org', () => {
  it('riapre quello esistente invece di crearne un altro', async () => {
    const { db, calls } = fakeDb({ chat_threads: [{ id: THREAD }] });

    const id = await openThread(db, { orgId: ORG, projectId: PROJECT, userId: USER });

    expect(id).toBe(THREAD);
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('la ricerca è scopata su org, progetto e utente', async () => {
    const { db, calls } = fakeDb({ chat_threads: [{ id: THREAD }] });

    await openThread(db, { orgId: ORG, projectId: PROJECT, userId: USER });

    expect(filtersOf(calls, 'select')).toMatchObject({ org_id: ORG, project_id: PROJECT, created_by: USER });
  });

  it('l insert porta org_id — senza, la service role scriverebbe nel tenant sbagliato', async () => {
    const { db, calls } = fakeDb({ chat_threads: [] });

    await openThread(db, { orgId: ORG, projectId: PROJECT, userId: USER, brandId: null });

    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.payload).toMatchObject({
      org_id: ORG,
      project_id: PROJECT,
      created_by: USER,
      surface: 'sidebar'
    });
  });
});

describe('saveTurn — seq progressivo e actor agente', () => {
  it('scrive actor_kind agent, actor_id e agent_key', async () => {
    const { db, calls } = fakeDb({ chat_messages: [{ seq: 4 }] });

    await saveTurn(db, {
      orgId: ORG,
      threadId: THREAD,
      role: 'user',
      content: 'ciao',
      actor: agentActor(USER)
    });

    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.payload).toMatchObject({
      org_id: ORG,
      thread_id: THREAD,
      seq: 5,
      actor_kind: 'agent',
      actor_id: USER,
      agent_key: SIDEBAR_AGENT_KEY
    });
  });

  it('la lettura della storia è scopata su org e thread', async () => {
    const { db, calls } = fakeDb({ chat_messages: [] });

    await loadTurns(db, { orgId: ORG, threadId: THREAD });

    expect(filtersOf(calls, 'select')).toMatchObject({ org_id: ORG, thread_id: THREAD });
    expect(calls.find((c) => c.op === 'select')!.limit).toBe(HISTORY_LIMIT);
  });
});

describe('i tool del turno sopravvivono al reload', () => {
  const TOOL = { toolCallId: 'c1', toolName: 'list_nodes', status: 'done' as const, input: { a: 1 }, output: { n: 3 } };

  it('saveTurn scrive i tool in tool_calls', async () => {
    const { db, calls } = fakeDb({ chat_messages: [] });

    await saveTurn(db, { orgId: ORG, threadId: THREAD, role: 'assistant', content: '', tools: [TOOL], actor: agentActor(USER) });

    expect(calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ tool_calls: [TOOL] });
  });

  it('un turno fatto solo di tool torna nella cronologia, ma non nel prompt', async () => {
    const { db } = fakeDb({ chat_messages: [{ role: 'assistant', content: '', tool_calls: [TOOL] }] });

    const turns = await loadTurns(db, { orgId: ORG, threadId: THREAD });

    expect(turns).toEqual([{ role: 'assistant', content: '', tools: [TOOL] }]);
    expect(promptHistory(turns)).toEqual([]);
  });
});

describe('gli allegati del messaggio sopravvivono al reload', () => {
  const LOGO = { assetId: 'a-1', kind: AttachmentKind.Image, name: 'logo.png', mimeType: 'image/png', bytes: 10 };

  it('saveTurn scrive gli allegati in attachments', async () => {
    const { db, calls } = fakeDb({ chat_messages: [] });

    await saveTurn(db, { orgId: ORG, threadId: THREAD, role: 'user', content: 'use this', attachments: [LOGO], actor: { kind: 'user', id: USER } });

    expect(calls.find((c) => c.op === 'insert')!.payload).toMatchObject({ attachments: [LOGO] });
  });

  it('un messaggio fatto solo di allegati torna nella cronologia e nel prompt, con gli asset', async () => {
    const { db } = fakeDb({ chat_messages: [{ role: 'user', content: '', attachments: [LOGO] }] });

    const turns = await loadTurns(db, { orgId: ORG, threadId: THREAD });

    expect(turns).toEqual([{ role: 'user', content: '', attachments: [LOGO] }]);
    expect(promptHistory(turns)).toEqual([{ role: 'user', content: '\n\n[Attached: logo.png (image, asset a-1)]' }]);
  });
});

describe('turnRunning — a turn still working after the client left', () => {
  const NOW = Date.parse('2026-10-08T12:00:00Z');
  const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

  it('an unanswered message sent a minute ago is a turn still running', async () => {
    const { db } = fakeDb({ chat_messages: [{ role: 'user', created_at: ago(60) }] });

    expect(await turnRunning(db, { orgId: ORG, threadId: THREAD }, NOW)).toBe(true);
  });

  it('an unanswered message sent twenty minutes ago is a turn still running', async () => {
    const { db } = fakeDb({ chat_messages: [{ role: 'user', created_at: ago(20 * 60) }] });

    expect(await turnRunning(db, { orgId: ORG, threadId: THREAD }, NOW)).toBe(true);
  });

  it('an answered message is a finished turn', async () => {
    const { db } = fakeDb({ chat_messages: [{ role: 'assistant', created_at: ago(60) }] });

    expect(await turnRunning(db, { orgId: ORG, threadId: THREAD }, NOW)).toBe(false);
  });

  it('an unanswered message older than the longest turn is a turn that died', async () => {
    const { db } = fakeDb({ chat_messages: [{ role: 'user', created_at: ago(3600) }] });

    expect(await turnRunning(db, { orgId: ORG, threadId: THREAD }, NOW)).toBe(false);
  });

  it('an answer still being written is a turn still running', async () => {
    const { db } = fakeDb({ chat_messages: [{ role: 'assistant', status: 'streaming', created_at: ago(60), updated_at: ago(5) }] });

    expect(await turnRunning(db, { orgId: ORG, threadId: THREAD }, NOW)).toBe(true);
  });

  it('an answer started longer ago than the platform lets a turn live is over, however recent its last write', async () => {
    const { db } = fakeDb({ chat_messages: [{ role: 'assistant', status: 'streaming', created_at: ago(AGENT_STALE_MS / 1000 + 60), updated_at: ago(5) }] });

    expect(await turnRunning(db, { orgId: ORG, threadId: THREAD }, NOW)).toBe(false);
  });

  it('an answer left streaming by a server that was cut is closed failed when read', async () => {
    const { db, calls } = fakeDb({ chat_messages: [{ id: 'm-1', role: 'assistant', status: 'streaming', created_at: ago(AGENT_STALE_MS / 1000 + 60), updated_at: ago(100) }] });

    await turnRunning(db, { orgId: ORG, threadId: THREAD }, NOW);
    const closed = calls.find((c) => c.table === 'chat_messages' && c.op === 'update');

    expect(closed?.payload).toMatchObject({ status: 'failed' });
    expect(closed?.filters).toEqual(expect.arrayContaining([['org_id', ORG], ['id', 'm-1'], ['status', 'streaming']]));
  });

  it('an answer marked done or failed is a finished turn', async () => {
    for (const status of ['done', 'failed']) {
      const { db } = fakeDb({ chat_messages: [{ role: 'assistant', status, created_at: ago(5), updated_at: ago(1) }] });

      expect(await turnRunning(db, { orgId: ORG, threadId: THREAD }, NOW)).toBe(false);
    }
  });

  it('an answer left streaming by a server that died is not running forever', async () => {
    const { db } = fakeDb({ chat_messages: [{ role: 'assistant', status: 'streaming', created_at: ago(3600), updated_at: ago(3600) }] });

    expect(await turnRunning(db, { orgId: ORG, threadId: THREAD }, NOW)).toBe(false);
  });
});

describe('loadTurns — the answer being written comes back with its status', () => {
  it('a streaming row returns its partial text and tools, marked streaming', async () => {
    const TOOL = { toolCallId: 'c1', toolName: 'list_nodes', status: 'done' as const };
    const { db } = fakeDb({ chat_messages: [{ role: 'assistant', content: 'Half', tool_calls: [TOOL], status: 'streaming' }, { role: 'user', content: 'go' }] });

    expect(await loadTurns(db, { orgId: ORG, threadId: THREAD })).toEqual([
      { role: 'user', content: 'go' },
      { role: 'assistant', content: 'Half', tools: [TOOL], streaming: true }
    ]);
  });
});

describe('saveTurn — a retry of an unanswered message', () => {
  it('does not write the same user message twice in a row', async () => {
    const { db, calls } = fakeDb({ chat_messages: [{ seq: 4, role: 'user', content: 'ciao' }] });

    await saveTurn(db, { orgId: ORG, threadId: THREAD, role: 'user', content: 'ciao', actor: { kind: 'user', id: USER } });

    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });
});
