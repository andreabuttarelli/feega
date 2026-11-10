import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryDb } from './memory-db';

const user = { id: 'u', email: 'u@x', created_at: '2026-01-01' };
const open = (latencyMs?: number) => createMemoryDb({ tables: new Map([['nodes', [{ id: 'a' }]]]), blobs: new Map(), user, storageUrl: () => '', onChange: () => {}, latencyMs });

describe('local mode with a remote database latency', () => {
  afterEach(() => vi.useRealTimers());

  it('answers a query only after the latency, so a bench sees round trips like Supabase', async () => {
    vi.useFakeTimers();
    let answered = false;
    const query = Promise.resolve(open(300).from('nodes').select('*')).then(() => (answered = true));

    await vi.advanceTimersByTimeAsync(299);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await query;
    expect(answered).toBe(true);
  });

  it('answers at once without one', async () => {
    const { data } = await open().from('nodes').select('*');
    expect(data).toEqual([{ id: 'a' }]);
  });
});
