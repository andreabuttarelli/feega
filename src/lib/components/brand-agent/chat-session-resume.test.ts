import { describe, it, expect, beforeEach } from 'vitest';
import { chatSession, forgetChatSessions } from './chat-session.svelte';

type Saved = { role: 'user' | 'assistant'; content: string; tools?: { toolCallId: string; toolName: string; status: 'done' }[]; streaming?: true };
type Thread = { messages: Saved[]; running: boolean; parts?: { type: string; data: unknown }[] };

const ENDPOINT = '/api/v1/projects/p/motion/n/agent';
const ASK = 'make it pop';
const OLD: Saved[] = [
  { role: 'user', content: 'first ask' },
  { role: 'assistant', content: 'first answer' }
];
const ASKED: Saved[] = [...OLD, { role: 'user', content: ASK }];

const methods: string[] = [];

function backgrounded(thread: Thread) {
  const encoder = new TextEncoder();
  let cut: (() => void) | null = null;

  const fetcher = (async (_url: string, init?: RequestInit) => {
    methods.push(init?.method ?? 'GET');
    if (init?.method === 'DELETE') {
      thread.running = false;
      return new Response(JSON.stringify({ stopped: true }), { status: 200 });
    }
    if (init?.method !== 'POST') {
      return new Response(JSON.stringify(thread), { status: 200 });
    }
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text-delta', id: 't', delta: 'Working on it' })}\n\n`));
        cut = () => controller.error(new TypeError('Load failed'));
      }
    });
    return new Response(body, { status: 200 });
  }) as typeof fetch;

  return { fetcher, cut: () => cut!() };
}

async function settle() {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function cutMidTurn(thread: Thread, running: boolean) {
  const server = backgrounded(thread);
  const session = chatSession(ENDPOINT, server.fetcher);
  await session.load();

  const sent = session.send(ASK, 'append-user');
  await settle();
  thread.messages = ASKED;
  thread.running = running;
  server.cut();
  await sent;
  await settle();
  return session;
}

describe('a chat whose tab went to the background', () => {
  beforeEach(() => {
    forgetChatSessions();
    methods.length = 0;
  });

  it('a cut stream keeps the whole transcript and follows the turn instead of failing', async () => {
    const session = await cutMidTurn({ messages: OLD, running: false }, true);

    expect(session.failed).toBe('');
    expect(session.reconnecting).toBe(true);
    expect(session.messages.map((m) => m.content)).toEqual(['first ask', 'first answer', ASK, 'Working on it']);
  });

  it('a cut stream does not announce the turn ended while it still runs, and announces it once when it lands', async () => {
    const thread: Thread = { messages: OLD, running: false };
    const server = backgrounded(thread);
    const session = chatSession(ENDPOINT, server.fetcher);
    let ended = 0;
    session.onTurnEnd = () => ended++;
    await session.load();

    const sent = session.send(ASK, 'append-user');
    await settle();
    thread.messages = ASKED;
    thread.running = true;
    server.cut();
    await sent;
    await settle();

    expect(ended).toBe(0);

    thread.messages = [...ASKED, { role: 'assistant', content: 'Made it pop.' }];
    thread.running = false;
    session.resume();
    await settle();

    expect(ended).toBe(1);
  });

  it('coming back to a turn that finished meanwhile shows its answer', async () => {
    const thread: Thread = { messages: OLD, running: false };
    const session = await cutMidTurn(thread, true);

    thread.messages = [...ASKED, { role: 'assistant', content: 'Made it pop.' }];
    thread.running = false;
    session.resume();
    await settle();

    expect(session.reconnecting).toBe(false);
    expect(session.failed).toBe('');
    expect(session.messages.map((m) => m.content)).toEqual(['first ask', 'first answer', ASK, 'Made it pop.']);
  });

  it('a reload during a running turn follows it rather than showing an empty or failed chat', async () => {
    const session = chatSession(ENDPOINT, backgrounded({ messages: ASKED, running: true }).fetcher);

    await session.load();
    await settle();

    expect(session.reconnecting).toBe(true);
    expect(session.failed).toBe('');
    expect(session.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(session.messages.at(-1)?.pending).toBe(true);
  });

  it('says the agent did not answer only when the turn ended on the server without an answer', async () => {
    const session = await cutMidTurn({ messages: OLD, running: false }, false);

    expect(session.reconnecting).toBe(false);
    expect(session.failed).toBe('send');
    expect(session.messages.map((m) => m.content)).toEqual(['first ask', 'first answer', ASK]);
  });

  it('coming back shows the steps done meanwhile, then swaps to the final answer in the same place', async () => {
    const STEP = { toolCallId: 'c1', toolName: 'add_clip', status: 'done' as const };
    const thread: Thread = { messages: [...ASKED, { role: 'assistant', content: 'Adding a title', tools: [STEP], streaming: true }], running: true };
    const session = chatSession(ENDPOINT, backgrounded(thread).fetcher);

    await session.load();
    await settle();

    expect(session.reconnecting).toBe(true);
    expect(session.messages.map((m) => m.content)).toEqual(['first ask', 'first answer', ASK, 'Adding a title']);
    expect(session.messages.at(-1)).toMatchObject({ live: true, pending: true, tools: [STEP] });

    thread.messages = [...ASKED, { role: 'assistant', content: 'Adding a title\n\nMade it pop.', tools: [STEP] }];
    thread.running = false;
    session.resume();
    await settle();

    expect(session.reconnecting).toBe(false);
    expect(session.failed).toBe('');
    expect(session.messages.map((m) => m.content)).toEqual(['first ask', 'first answer', ASK, 'Adding a title\n\nMade it pop.']);
    expect(session.messages.at(-1)?.live).toBeFalsy();
  });

  it('a reload during a running turn hands the agent work done so far to the page, and keeps handing it while it follows', async () => {
    const WORK = { type: 'data-motion-doc', data: { edit: 2, doc: { tracks: [] } } };
    const thread: Thread = { messages: ASKED, running: true, parts: [WORK] };
    const session = chatSession(ENDPOINT, backgrounded(thread).fetcher);
    const seen: unknown[] = [];
    session.onData = (part) => seen.push(part);

    await session.load();
    await settle();
    session.resume();
    await settle();

    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[0]).toEqual(WORK);
  });

  it('stop on a turn followed after a reload ends it on the server and leaves the running state at once', async () => {
    const thread: Thread = { messages: [...ASKED, { role: 'assistant', content: 'Adding a title', streaming: true }], running: true };
    const session = chatSession(ENDPOINT, backgrounded(thread).fetcher);
    let ended = 0;
    session.onTurnEnd = () => ended++;
    await session.load();
    await settle();

    session.stop();

    expect(session.reconnecting).toBe(false);
    expect(session.messages.at(-1)).toMatchObject({ content: 'Adding a title', pending: false, live: false });
    expect(methods).toContain('DELETE');
    expect(ended).toBe(1);
  });
});
