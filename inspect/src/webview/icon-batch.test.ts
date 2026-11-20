import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREVIEW_BATCH_DELAY_MS, previewBatcher } from './icon-batch';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('previewBatcher', () => {
  it('sends the names that scrolled into view together, once', () => {
    const sent: string[][] = [];
    const batcher = previewBatcher((names) => sent.push(names));
    batcher.want('a');
    batcher.want('b');
    batcher.want('a');
    vi.advanceTimersByTime(PREVIEW_BATCH_DELAY_MS);

    expect(sent).toEqual([['a', 'b']]);
  });

  it('does not ask again for a name already sent', () => {
    const sent: string[][] = [];
    const batcher = previewBatcher((names) => sent.push(names));
    batcher.want('a');
    vi.advanceTimersByTime(PREVIEW_BATCH_DELAY_MS);
    batcher.want('a');
    batcher.want('b');
    vi.advanceTimersByTime(PREVIEW_BATCH_DELAY_MS);

    expect(sent).toEqual([['a'], ['b']]);
  });

  it('sends nothing when nothing is wanted', () => {
    const sent: string[][] = [];
    previewBatcher((names) => sent.push(names));
    vi.advanceTimersByTime(PREVIEW_BATCH_DELAY_MS * 3);

    expect(sent).toEqual([]);
  });

  it('skips names that already have a preview', () => {
    const sent: string[][] = [];
    const batcher = previewBatcher((names) => sent.push(names), (name) => name === 'a');
    batcher.want('a');
    batcher.want('b');
    vi.advanceTimersByTime(PREVIEW_BATCH_DELAY_MS);

    expect(sent).toEqual([['b']]);
  });
});
