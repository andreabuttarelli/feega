import { describe, it, expect } from 'vitest';
import { ChatSession } from './chat-session.svelte';

const sse = (evt: object) => `data: ${JSON.stringify(evt)}\n\n`;

function streaming(events: object[]) {
  return (async (_url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') {
      return new Response(JSON.stringify({ messages: [] }));
    }
    return new Response(events.map(sse).join(''));
  }) as typeof fetch;
}

describe('reasoning streamed by the model', () => {
  it('lands on the assistant message, apart from the answer', async () => {
    const session = new ChatSession('/x', streaming([
      { type: 'reasoning-start', id: 'r' },
      { type: 'reasoning-delta', id: 'r', delta: 'Weighing options.' },
      { type: 'text-delta', id: 't', delta: 'Done.' }
    ]));
    await session.send('hi', 'append-user');
    expect(session.messages.at(-1)).toMatchObject({ content: 'Done.', reasoning: 'Weighing options.' });
  });

  it('the turn body carries the model choice from the context', async () => {
    let sent = '';
    const session = new ChatSession('/x', (async (_u: string, init?: RequestInit) => {
      sent = String(init?.body ?? '');
      return new Response(sse({ type: 'text-delta', id: 't', delta: 'ok' }));
    }) as typeof fetch);
    session.context = () => ({ model: 'z-ai/glm-5.3-flash', reasoning: 'low' });
    await session.send('hi', 'append-user');
    expect(JSON.parse(sent)).toEqual({ model: 'z-ai/glm-5.3-flash', reasoning: 'low', message: 'hi' });
  });
});
