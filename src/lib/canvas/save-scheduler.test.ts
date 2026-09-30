import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveStatus, SaveTiming, SendResult, createSaveScheduler } from './save-scheduler';

type Sent = { id: string; patch: Record<string, unknown>; resolve: (result: SendResult) => void };

function harness(opts: { debounceMs?: number; maxWaitMs?: number } = {}) {
  const sent: Sent[] = [];
  const statuses: SaveStatus[] = [];
  const saves = createSaveScheduler({
    send: (id, patch) => new Promise((resolve) => sent.push({ id, patch, resolve })),
    debounceMs: opts.debounceMs ?? 400,
    maxWaitMs: opts.maxWaitMs ?? 2000,
    backoffMs: (attempt) => 1000 * attempt,
    onStatus: (status) => statuses.push(status)
  });
  return { saves, sent, statuses };
}

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('save scheduler', () => {
  it('coalesces 200 keystrokes into one request after the debounce', async () => {
    const { saves, sent } = harness();
    for (let i = 1; i <= 200; i += 1) {
      saves.schedule('a', { prompt: 'x'.repeat(i) });
      await vi.advanceTimersByTimeAsync(5);
    }
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(400);
    expect(sent).toHaveLength(1);
    expect(sent[0].patch).toEqual({ prompt: 'x'.repeat(200) });
  });

  it('sends by max wait while typing never pauses', async () => {
    const { saves, sent } = harness();
    for (let i = 0; i < 30; i += 1) {
      saves.schedule('a', { prompt: String(i) });
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(sent.length).toBeGreaterThanOrEqual(1);
    expect(sent.length).toBeLessThanOrEqual(2);
  });

  it('keeps the latest value per field and every field touched', async () => {
    const { saves, sent } = harness();
    saves.schedule('a', { prompt: 'a', model: 'm1' });
    saves.schedule('a', { prompt: 'b' });
    await vi.advanceTimersByTimeAsync(400);
    expect(sent[0].patch).toEqual({ prompt: 'b', model: 'm1' });
  });

  it('keeps one request in flight per node and merges newer edits into the next', async () => {
    const { saves, sent } = harness();
    saves.schedule('a', { prompt: '1' });
    await vi.advanceTimersByTimeAsync(400);
    saves.schedule('a', { prompt: '2' });
    saves.schedule('a', { index: 3 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toHaveLength(1);
    sent[0].resolve(SendResult.Saved);
    await vi.advanceTimersByTimeAsync(400);
    expect(sent).toHaveLength(2);
    expect(sent[1].patch).toEqual({ prompt: '2', index: 3 });
  });

  it('saves nodes independently', async () => {
    const { saves, sent } = harness();
    saves.schedule('a', { prompt: '1' });
    saves.schedule('b', { index: 2 });
    await vi.advanceTimersByTimeAsync(400);
    expect(sent.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });

  it('flush sends at once and resolves when saved', async () => {
    const { saves, sent } = harness();
    saves.schedule('a', { prompt: '1' });
    let done = false;
    void saves.flush().then(() => { done = true; });
    await settle();
    expect(sent).toHaveLength(1);
    expect(done).toBe(false);
    sent[0].resolve(SendResult.Saved);
    await settle();
    expect(done).toBe(true);
  });

  it('flush of one node leaves the others debounced', async () => {
    const { saves, sent } = harness();
    saves.schedule('a', { prompt: '1' });
    saves.schedule('b', { prompt: '2' });
    void saves.flush('a');
    await settle();
    expect(sent.map((s) => s.id)).toEqual(['a']);
  });

  it('an immediate save skips the debounce and reports the outcome', async () => {
    const { saves, sent } = harness();
    const saved = saves.schedule('a', { refId: 'r' }, SaveTiming.Now);
    await settle();
    expect(sent).toHaveLength(1);
    sent[0].resolve(SendResult.Saved);
    await expect(saved).resolves.toBe(true);
  });

  it('retries offline with backoff, keeping edits made meanwhile', async () => {
    const { saves, sent, statuses } = harness();
    const saved = saves.schedule('a', { prompt: '1', model: 'm' });
    await vi.advanceTimersByTimeAsync(400);
    sent[0].resolve(SendResult.Retry);
    await settle();
    expect(saves.status()).toBe(SaveStatus.Retrying);
    saves.schedule('a', { prompt: '12' });
    await vi.advanceTimersByTimeAsync(999);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(2);
    expect(sent[1].patch).toEqual({ prompt: '12', model: 'm' });
    sent[1].resolve(SendResult.Saved);
    await expect(saved).resolves.toBe(true);
    expect(saves.status()).toBe(SaveStatus.Saved);
    expect(statuses).toContain(SaveStatus.Saving);
  });

  it('a refused save resolves false and frees the node', async () => {
    const { saves, sent } = harness();
    const saved = saves.schedule('a', { prompt: '1' }, SaveTiming.Now);
    await settle();
    sent[0].resolve(SendResult.Dropped);
    await expect(saved).resolves.toBe(false);
    expect(saves.unsent()).toBe(false);
  });

  it('reports dirty fields while pending and in flight', async () => {
    const { saves, sent } = harness();
    saves.schedule('a', { prompt: '1' });
    expect(saves.dirtyKeys('a')).toEqual(['prompt']);
    expect(saves.sending('a')).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    expect(saves.sending('a')).toBe(true);
    saves.schedule('a', { index: 2 });
    expect(saves.dirtyKeys('a').sort()).toEqual(['index', 'prompt']);
    expect(saves.unsent()).toBe(true);
    sent[0].resolve(SendResult.Saved);
    await settle();
    expect(saves.dirtyKeys('a')).toEqual(['index']);
    expect(saves.dirtyKeys('b')).toEqual([]);
  });

  it('typing while a run starts is held until the run answers, so the run never loses to its own prompt', async () => {
    const { saves, sent } = harness();
    const release = saves.hold('a');

    saves.schedule('a', { prompt: 'typed during run' });
    await vi.advanceTimersByTimeAsync(3000);
    expect(sent).toHaveLength(0);
    expect(saves.dirtyKeys('a')).toEqual(['prompt']);

    release();
    await vi.advanceTimersByTimeAsync(400);
    expect(sent.map((s) => s.patch)).toEqual([{ prompt: 'typed during run' }]);
  });
});
