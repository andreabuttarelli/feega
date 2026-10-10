import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberTourSeen, seenInBrowser } from './tour-memory';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v)
});

const answer = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

beforeEach(() => store.clear());

describe('ricordare che il tour è stato visto', () => {
  it('salvato sul profilo, il browser non serve', async () => {
    await rememberTourSeen(answer(200, { saved: true }));
    expect(seenInBrowser()).toBe(false);
  });

  it('senza colonna lo ricorda il browser', async () => {
    await rememberTourSeen(answer(200, { saved: false }));
    expect(seenInBrowser()).toBe(true);
  });

  it('con la rete giù lo ricorda il browser', async () => {
    await rememberTourSeen(vi.fn(async () => Promise.reject(new Error('offline'))) as unknown as typeof fetch);
    expect(seenInBrowser()).toBe(true);
  });
});
