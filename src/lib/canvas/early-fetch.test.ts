import { describe, expect, it } from 'vitest';
import { earlyFetch } from './early-fetch';

describe('fetching the editor session when the frame is selected', () => {
  it('the open takes the request already in flight once, then asks again', async () => {
    let now = 0;
    const asked: string[] = [];
    const early = earlyFetch<string>({ load: async (url) => (asked.push(url), `doc ${asked.length}`), now: () => now });

    early.start('/a/session');
    early.start('/a/session');
    expect(await early.take('/a/session')).toBe('doc 1');
    expect(await early.take('/a/session')).toBe('doc 2');
    expect(asked).toEqual(['/a/session', '/a/session']);
  });

  it('a warmed session that lands is handed on, so a later open can reuse it by version past the freshness window', async () => {
    const landed: [string, string][] = [];
    const early = earlyFetch<string>({ load: async () => 'doc', now: () => 0, landed: (url, value) => landed.push([url, value]) });

    early.start('/a/session');
    await early.take('/a/session');
    expect(landed).toEqual([['/a/session', 'doc']]);
  });

  it('a selection long ago is stale: the open asks again, never edits an old version', async () => {
    let now = 0;
    let n = 0;
    const early = earlyFetch<number>({ load: async () => ++n, now: () => now });

    early.start('/a/session');
    now = 60_000;
    expect(await early.take('/a/session')).toBe(2);
  });

  it('a session already landed opens in the same frame, with no wait', async () => {
    const early = earlyFetch<string>({ load: async () => 'doc', now: () => 0 });

    expect(early.settled('/a/session')).toBeUndefined();
    early.start('/a/session');
    await Promise.resolve();
    expect(early.settled('/a/session')).toBe('doc');
  });

  it('a landed session past its freshness is not offered', async () => {
    let now = 0;
    const early = earlyFetch<string>({ load: async () => 'doc', now: () => now });

    early.start('/a/session');
    await Promise.resolve();
    now = 60_000;
    expect(early.settled('/a/session')).toBeUndefined();
  });

  it('a session asked for while its editor is open is never handed to the next open', async () => {
    let n = 0;
    const early = earlyFetch<number>({ load: async () => ++n, now: () => 0 });

    early.start('/a/session');
    const release = early.hold('/a/session');
    expect(await early.take('/a/session')).toBe(1);
    early.start('/a/session');
    await Promise.resolve();
    release();

    expect(early.settled('/a/session')).toBeUndefined();
    expect(await early.take('/a/session')).toBe(2);
  });

  it('a hover after the editor closed warms a fresh session again', async () => {
    let n = 0;
    const early = earlyFetch<number>({ load: async () => ++n, now: () => 0 });

    early.hold('/a/session')();
    early.start('/a/session');
    await Promise.resolve();
    expect(early.settled('/a/session')).toBe(1);
  });
});
