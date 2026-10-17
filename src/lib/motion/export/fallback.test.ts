import { describe, expect, it } from 'vitest';
import { orFallback } from './fallback';

const live = () => new AbortController().signal;

describe('orFallback', () => {
  it('keeps the first attempt when it works', async () => {
    expect(await orFallback(async () => 'gpu', async () => 'html', live())).toBe('gpu');
  });

  it('redoes the whole export on the fallback when the first attempt fails', async () => {
    const seen: unknown[] = [];

    expect(await orFallback(async () => Promise.reject(new Error('device lost')), async () => 'html', live(), (e) => seen.push(e))).toBe('html');
    expect(seen).toHaveLength(1);
  });

  it('does not retry an export the user cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(orFallback(async () => Promise.reject(new Error('aborted')), async () => 'html', controller.signal)).rejects.toThrow('aborted');
  });

  it('fails as before when there is no fallback', async () => {
    await expect(orFallback(async () => Promise.reject(new Error('boom')), null, live())).rejects.toThrow('boom');
  });
});
