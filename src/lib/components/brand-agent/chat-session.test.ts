import { describe, it, expect } from 'vitest';
import { chatSession, anyChatRunning, forgetChatSessions } from './chat-session.svelte';
import { AttachmentKind } from '$lib/chat-attachments';

type Pipe = { push: (text: string) => void; end: () => void };

function sse(evt: object): string {
  return `data: ${JSON.stringify(evt)}\n\n`;
}

function fakeServer(saved: object[] = []) {
  const encoder = new TextEncoder();
  let pipe: Pipe | null = null;

  const fetcher = (async (_url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') {
      return new Response(JSON.stringify({ messages: saved }), { status: 200 });
    }
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        pipe = {
          push: (text) => controller.enqueue(encoder.encode(sse({ type: 'text-delta', id: 't', delta: text }))),
          end: () => controller.close()
        };
      }
    });
    return new Response(body, { status: 200 });
  }) as typeof fetch;

  return { fetcher, pipe: () => pipe! };
}

async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('chatSession', () => {
  it('il turno in corso sopravvive allo smontaggio del pannello: chi si riattacca lo ritrova vivo', async () => {
    forgetChatSessions();
    const server = fakeServer();
    const first = chatSession('/api/v1/projects/p/agent', server.fetcher);
    await first.load();

    const sent = first.send('make a doc', 'append-user');
    await settle();
    server.pipe().push('Created ');
    await settle();

    const reattached = chatSession('/api/v1/projects/p/agent', server.fetcher);
    expect(reattached).toBe(first);
    expect(reattached.sending).toBe(true);
    expect(reattached.messages.at(-1)?.content).toBe('Created ');

    server.pipe().push('the doc.');
    server.pipe().end();
    await sent;

    expect(reattached.sending).toBe(false);
    expect(reattached.messages.map((m) => m.content)).toEqual(['make a doc', 'Created the doc.']);
  });

  it('ricaricare la cronologia a metà turno non cancella la risposta che sta arrivando', async () => {
    forgetChatSessions();
    const server = fakeServer([{ role: 'user', content: 'old' }]);
    const session = chatSession('/api/v1/projects/p/agent', server.fetcher);
    await session.load();

    const sent = session.send('make a doc', 'append-user');
    await settle();
    server.pipe().push('Working');
    await settle();

    await session.load();
    expect(session.messages.at(-1)?.content).toBe('Working');

    server.pipe().end();
    await sent;
  });

  it('anyChatRunning dice se una chat sta ancora lavorando', async () => {
    forgetChatSessions();
    const server = fakeServer();
    const session = chatSession('/api/v1/projects/p/agent', server.fetcher);
    await session.load();
    expect(anyChatRunning()).toBe(false);

    const sent = session.send('hi', 'append-user');
    await settle();
    expect(anyChatRunning()).toBe(true);

    server.pipe().push('ok');
    server.pipe().end();
    await sent;
    expect(anyChatRunning()).toBe(false);
  });

  it('a blocked prompt keeps the server reason, not the generic "the agent didn\'t answer"', async () => {
    forgetChatSessions();
    const reason = "This prompt was blocked: sexual content isn't allowed in feega's standard mode.";
    const fetcher = (async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ error: reason, code: 'prompt_blocked' }), { status: 422 })
        : new Response(JSON.stringify({ messages: [] }), { status: 200 })) as typeof fetch;
    const session = chatSession('/api/v1/projects/blocked/agent', fetcher);
    await session.load();

    await session.send('something explicit', 'append-user');

    expect(session.failed).toBe('blocked');
    expect(session.failedDetail).toBe(reason);
    expect(session.messages.map((m) => m.role)).toEqual(['user']);
  });

  it('a data part the page must answer reaches it while the turn is still streaming', async () => {
    forgetChatSessions();
    const evt = { type: 'data-motion-frames', data: { callId: 'call_1', times: [1] } };
    const fetcher = (async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? new Response(sse(evt), { status: 200 }) : new Response(JSON.stringify({ messages: [] }), { status: 200 })) as typeof fetch;
    const session = chatSession('/api/v1/projects/p/motion/n/agent', fetcher);
    const seen: unknown[] = [];
    session.onData = (part) => seen.push(part);

    await session.send('look', 'append-user');

    expect(seen).toEqual([evt]);
  });
});

describe('chatSession — attachments', () => {
  it('send carries the asset ids and echoes the chips on the user message; retry sends them again', async () => {
    forgetChatSessions();
    const bodies: Record<string, unknown>[] = [];
    let fail = true;
    const fetcher = (async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') {
        return new Response(JSON.stringify({ messages: [] }), { status: 200 });
      }
      bodies.push(JSON.parse(String(init.body)));
      if (fail) {
        fail = false;
        return new Response(JSON.stringify({ error: 'x' }), { status: 500 });
      }
      return new Response(sse({ type: 'text-delta', id: 't', delta: 'ok' }), { status: 200 });
    }) as typeof fetch;
    const logo = { assetId: 'a-1', kind: AttachmentKind.Image, name: 'logo.png', mimeType: 'image/png', bytes: 10 };
    const session = chatSession('/api/v1/projects/p/attach', fetcher);
    await session.load();

    await session.send('place it', 'append-user', [logo]);

    expect(bodies[0]).toMatchObject({ message: 'place it', attachments: ['a-1'] });
    expect(session.messages[0]).toMatchObject({ role: 'user', content: 'place it', attachments: [logo] });

    session.retry();
    await settle();
    expect(bodies[1]).toMatchObject({ message: 'place it', attachments: ['a-1'] });
  });

  it('a message of attachments only is sent', async () => {
    forgetChatSessions();
    const bodies: Record<string, unknown>[] = [];
    const fetcher = (async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(sse({ type: 'text-delta', id: 't', delta: 'ok' }), { status: 200 });
      }
      return new Response(JSON.stringify({ messages: [] }), { status: 200 });
    }) as typeof fetch;
    const session = chatSession('/api/v1/projects/p/only', fetcher);
    await session.load();

    await session.send('', 'append-user', [{ assetId: 'a-2', kind: AttachmentKind.Document, name: 'brief.pdf', mimeType: 'application/pdf', bytes: 3 }]);

    expect(bodies).toHaveLength(1);
  });
});
