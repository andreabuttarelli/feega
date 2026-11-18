import { describe, expect, it, vi } from 'vitest';
import { AcpChat, Line } from './acp-chat.svelte';
import { AcpEventKind, encodeAcpEvent, type AcpEvent } from './acp-events';

const ACP_URL = '/api/v1/local/acp';

function server(events: AcpEvent[]) {
  const calls: unknown[] = [];
  const fetcher = async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string));
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        events.forEach((e) => c.enqueue(new TextEncoder().encode(encodeAcpEvent(e))));
        c.close();
      }
    });
    return new Response(body);
  };
  return { calls, fetcher: fetcher as typeof fetch };
}

const PERMISSION: AcpEvent = { kind: AcpEventKind.Permission, id: 'p1', title: 'feega edit', options: [{ optionId: 'no', name: 'Reject', kind: 'reject_once' }, { optionId: 'yes', name: 'Allow', kind: 'allow_once' }] };

describe('AcpChat', () => {
  it('shows the prompt before the agent answers, then the streamed reply', async () => {
    const { calls, fetcher } = server([
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hel' } } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'lo' } } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'tool_call', title: 'feega edit' } },
      { kind: AcpEventKind.Done, stopReason: 'end_turn' }
    ]);
    const chat = new AcpChat(fetcher);

    const turn = chat.send('claude', 'add a title');
    expect(chat.lines[0]).toEqual({ line: Line.User, text: 'add a title' });
    await turn;

    expect(calls[0]).toEqual({ thread: chat.thread, agent: 'claude', prompt: 'add a title' });
    expect(chat.lines.slice(1)).toEqual([
      { line: Line.Agent, text: 'hello', reasoning: '', tools: [] },
      { line: Line.Agent, text: '', reasoning: '', tools: [{ toolCallId: undefined, toolName: 'feega edit', status: 'running', input: undefined, output: undefined }] }
    ]);
    expect(chat.busy).toBe(false);
  });

  it('shows a permission prompt and sends the user choice once', async () => {
    const { calls, fetcher } = server([PERMISSION, { kind: AcpEventKind.Done, stopReason: 'end_turn' }]);
    const chat = new AcpChat(fetcher);
    await chat.send('codex', 'x');

    const asked = chat.lines[1];
    expect(asked).toMatchObject({ line: Line.Permission, id: 'p1', title: 'feega edit', chosen: null });

    const sent = chat.answer('p1', 'yes');
    expect(chat.lines[1]).toMatchObject({ chosen: 'yes' });
    await sent;
    await chat.answer('p1', 'no');

    expect(calls.slice(1)).toEqual([{ permission: { id: 'p1', optionId: 'yes' } }]);
  });

  it('takes the choice back and says so when the answer does not reach the agent', async () => {
    const { fetcher } = server([PERMISSION]);
    const chat = new AcpChat(fetcher);
    await chat.send('claude', 'x');
    chat.fetcher = (async () => new Response(null, { status: 404 })) as typeof fetch;

    await chat.answer('p1', 'yes');

    expect(chat.lines[1]).toMatchObject({ chosen: null });
    expect(chat.lines.at(-1)).toMatchObject({ line: Line.Error });
  });

  it('reports a failed turn', async () => {
    const { fetcher } = server([{ kind: AcpEventKind.Failed, message: 'spawn claude ENOENT' }]);
    const chat = new AcpChat(fetcher);
    await chat.send('claude', 'x');

    expect(chat.lines.at(-1)).toEqual({ line: Line.Error, text: 'spawn claude ENOENT' });
  });

  it('updates a step in place as the agent reports its progress', async () => {
    const { fetcher } = server([
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Read', status: 'pending' } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', title: 'Read src/app.css', rawInput: { path: 'src/app.css' } } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed', rawOutput: 'ok' } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'tool_call', toolCallId: 't2', title: 'Edit', status: 'in_progress' } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'tool_call_update', toolCallId: 't2', status: 'failed' } },
      { kind: AcpEventKind.Done, stopReason: 'end_turn' }
    ]);
    const chat = new AcpChat(fetcher);
    await chat.send('codex', 'x');

    expect(chat.lines[1]).toMatchObject({
      line: Line.Agent,
      tools: [
        { toolCallId: 't1', toolName: 'Read src/app.css', status: 'done', input: { path: 'src/app.css' }, output: 'ok' },
        { toolCallId: 't2', toolName: 'Edit', status: 'error' }
      ]
    });
  });

  it('shows the agent thinking, and starts a new step after text', async () => {
    const { fetcher } = server([
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'look ' } } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'first' } } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'done' } } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'again' } } },
      { kind: AcpEventKind.Done, stopReason: 'end_turn' }
    ]);
    const chat = new AcpChat(fetcher);
    await chat.send('claude', 'x');

    expect(chat.lines.slice(1)).toEqual([
      { line: Line.Agent, text: 'done', reasoning: 'look first', tools: [] },
      { line: Line.Agent, text: '', reasoning: 'again', tools: [] }
    ]);
  });

  it('shows the latest plan, replacing the previous one', async () => {
    const { fetcher } = server([
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'plan', entries: [{ content: 'Read', status: 'pending', priority: 'high' }] } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'plan', entries: [{ content: 'Read', status: 'completed', priority: 'high' }, { content: 'Edit', status: 'in_progress', priority: 'high' }] } },
      { kind: AcpEventKind.Done, stopReason: 'end_turn' }
    ]);
    const chat = new AcpChat(fetcher);
    await chat.send('claude', 'x');

    expect(chat.lines.slice(1)).toEqual([{ line: Line.Plan, entries: [{ content: 'Read', status: 'completed' }, { content: 'Edit', status: 'in_progress' }] }]);
  });

  it('says the agent is starting until its first update arrives', async () => {
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const fetcher = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          async start(c) {
            c.enqueue(new TextEncoder().encode(encodeAcpEvent({ kind: AcpEventKind.Starting })));
            await gate;
            c.enqueue(new TextEncoder().encode(encodeAcpEvent({ kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hi' } } })));
            c.close();
          }
        })
      )) as unknown as typeof fetch;
    const chat = new AcpChat(fetcher);

    const turn = chat.send('claude', 'x');
    await vi.waitFor(() => expect(chat.starting).toBe(true));
    release();
    await turn;

    expect(chat.starting).toBe(false);
  });

  it('stop cancels the turn on the agent, keeps what it wrote and says it stopped', async () => {
    const calls: Record<string, unknown>[] = [];
    let finish = () => {};
    const fetcher = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      calls.push(body);
      if (body.cancel) {
        finish();
        return new Response(null, { status: 204 });
      }

      return new Response(
        new ReadableStream<Uint8Array>({
          async start(c) {
            c.enqueue(new TextEncoder().encode(encodeAcpEvent({ kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'partial' } } })));
            await new Promise<void>((r) => (finish = r));
            c.enqueue(new TextEncoder().encode(encodeAcpEvent({ kind: AcpEventKind.Done, stopReason: 'cancelled' })));
            c.close();
          }
        })
      );
    }) as unknown as typeof fetch;
    const chat = new AcpChat(fetcher);

    const turn = chat.send('claude', 'x');
    await vi.waitFor(() => expect(chat.lines[1]).toMatchObject({ text: 'partial' }));
    await chat.stop();
    await turn;

    expect(calls[1]).toEqual({ cancel: chat.thread });
    expect(chat.lines.slice(1)).toEqual([{ line: Line.Agent, text: 'partial', reasoning: '', tools: [] }, { line: Line.Stopped }]);
    expect(chat.busy).toBe(false);
  });

  it('a new thread forgets the lines and talks to a fresh agent session', async () => {
    const { calls, fetcher } = server([{ kind: AcpEventKind.Done, stopReason: 'end_turn' }]);
    const chat = new AcpChat(fetcher);
    await chat.send('claude', 'x');
    const first = chat.thread;

    chat.restart();
    await chat.send('claude', 'y');

    expect(chat.thread).not.toBe(first);
    expect(chat.lines).toEqual([{ line: Line.User, text: 'y' }]);
    expect(calls.map((c) => (c as { thread: string }).thread)).toEqual([first, chat.thread]);
  });

  it('stop aborts the running turn when the agent cannot be reached to cancel', async () => {
    const fetcher = ((_url: string, init: RequestInit) =>
      JSON.parse(init.body as string).cancel
        ? Promise.resolve(new Response(null, { status: 404 }))
        : new Promise((_, reject) => {
            init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          })) as unknown as typeof fetch;
    const chat = new AcpChat(fetcher);

    const turn = chat.send('claude', 'x');
    expect(chat.busy).toBe(true);
    await chat.stop();
    await turn;

    expect(chat.busy).toBe(false);
    expect(chat.lines).toEqual([{ line: Line.User, text: 'x' }, { line: Line.Stopped }]);
  });

  it('counts every change, so the panel can follow the latest line', async () => {
    const { fetcher } = server([
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'a' } } },
      { kind: AcpEventKind.Update, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'b' } } },
      { kind: AcpEventKind.Done, stopReason: 'end_turn' }
    ]);
    const chat = new AcpChat(fetcher);
    await chat.send('claude', 'x');

    expect(chat.revision).toBeGreaterThanOrEqual(4);
  });
});
