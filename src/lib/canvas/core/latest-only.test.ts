import { describe, expect, it, vi } from 'vitest';
import { latestOnly } from './latest-only';

const FRAME_MS = 1000 / 30;
const BUILD_MS = 100;
const PLAY_MS = 1000;

describe('latestOnly', () => {
  it('drops frames superseded while a slow build runs, and always builds the newest', async () => {
    vi.useFakeTimers();
    const built: number[] = [];
    const ask = latestOnly<string, number>(async (_id, frame) => {
      await new Promise((resolve) => setTimeout(resolve, BUILD_MS));
      built.push(frame);
    });

    const asked = Math.round(PLAY_MS / FRAME_MS);
    for (let frame = 0; frame < asked; frame++) {
      ask('f', frame);
      await vi.advanceTimersByTimeAsync(FRAME_MS);
    }
    await vi.advanceTimersByTimeAsync(BUILD_MS * 2);
    vi.useRealTimers();

    expect(built.length).toBeLessThanOrEqual(Math.ceil(PLAY_MS / BUILD_MS) + 1);
    expect(built.at(-1)).toBe(asked - 1);
    expect([...built].sort((a, b) => a - b)).toEqual(built);
  });

  it('keeps frames of different ids apart', async () => {
    const built: string[] = [];
    const ask = latestOnly<string, number>(async (id, frame) => {
      built.push(`${id}${frame}`);
    });

    ask('a', 1);
    ask('b', 1);
    await Promise.resolve();

    expect(built).toEqual(['a1', 'b1']);
  });

  it('keeps building after a build throws', async () => {
    const built: number[] = [];
    const ask = latestOnly<string, number>(async (_id, frame) => {
      if (frame === 0) {
        throw new Error('boom');
      }
      built.push(frame);
    });

    ask('f', 0);
    ask('f', 1);
    await vi.waitFor(() => expect(built).toEqual([1]));
  });
});
