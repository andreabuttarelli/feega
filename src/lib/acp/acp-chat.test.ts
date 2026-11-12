import { describe, expect, it } from 'vitest';
import { AcpChat, Line } from './acp-chat.svelte';
import { AcpEventKind, encodeAcpEvent, type AcpEvent } from './acp-events';
import { AcpAgent } from './agent-choices';

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

    const turn = chat.send(AcpAgent.Claude, 'add a title');
    expect(chat.lines[0]).toEqual({ line: Line.User, text: 'add a title' });
    await turn;

    expect(calls[0]).toEqual({ agent: 'claude', prompt: 'add a title' });
    expect(chat.lines.slice(1)).toEqual([{ line: Line.Agent, text: 'hello' }, { line: Line.Tool, title: 'feega edit' }]);
    expect(chat.busy).toBe(false);
  });

  it('shows a permission prompt and sends the user choice once', async () => {
    const { calls, fetcher } = server([PERMISSION, { kind: AcpEventKind.Done, stopReason: 'end_turn' }]);
    const chat = new AcpChat(fetcher);
    await chat.send(AcpAgent.Codex, 'x');

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
    await chat.send(AcpAgent.Claude, 'x');
    chat.fetcher = (async () => new Response(null, { status: 404 })) as typeof fetch;

    await chat.answer('p1', 'yes');

    expect(chat.lines[1]).toMatchObject({ chosen: null });
    expect(chat.lines.at(-1)).toMatchObject({ line: Line.Error });
  });

  it('reports a failed turn', async () => {
    const { fetcher } = server([{ kind: AcpEventKind.Failed, message: 'spawn claude ENOENT' }]);
    const chat = new AcpChat(fetcher);
    await chat.send(AcpAgent.Claude, 'x');

    expect(chat.lines.at(-1)).toEqual({ line: Line.Error, text: 'spawn claude ENOENT' });
  });
});
