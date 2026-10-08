import { describe, expect, it } from 'vitest';
import { RenderQueue, RenderStage, STALL_AFTER_MS, Stall, chunkPlan, progressOf, advance, framesDone, renderStall, watchProgress, type RenderProgress, type RenderView } from './server-render';

describe('chunkPlan', () => {
  it('splits a 28 s trailer into two chunks of 15 s at most', () => {
    expect(chunkPlan(840)).toEqual({ size: 420, count: 2 });
  });

  it('never asks for more than eight sandboxes: a long video gets bigger chunks', () => {
    expect(chunkPlan(6000)).toEqual({ size: 750, count: 8 });
  });

  it('a clip shorter than one chunk is one chunk', () => {
    expect(chunkPlan(45)).toEqual({ size: 45, count: 1 });
  });

  it('heavy frames make the chunks smaller, each a minute and a half of work, up to sixty-four workers', () => {
    const heavy = Array.from({ length: 900 }, () => 2500);
    const heavier = Array.from({ length: 900 }, () => 25_000);

    expect(chunkPlan(900, heavy).size * 2500).toBeLessThanOrEqual(90_000);
    expect(chunkPlan(900, heavy).size).toBeLessThan(chunkPlan(900).size);
    expect(chunkPlan(900, heavier).count).toBeLessThanOrEqual(64);
  });

  const MASKING_LOOP_FRAME_MS = 8460;
  const FARM_SWEEP_2026_10_06 = [
    { workers: 8, seconds: 724, usd: 0.234 },
    { workers: 16, seconds: 559, usd: 0.244 },
    { workers: 27, seconds: 249, usd: 0.23 },
    { workers: 54, seconds: 203, usd: 0.321 }
  ];

  it('the masking loop gets the worker count that cost the least seconds × dollars on the farm', () => {
    const best = FARM_SWEEP_2026_10_06.reduce((a, b) => (a.seconds * a.usd <= b.seconds * b.usd ? a : b));

    expect(chunkPlan(270, Array.from({ length: 270 }, () => MASKING_LOOP_FRAME_MS)).count).toBe(best.workers);
  });

  it('speed alone stops at 32 workers: past it the sandboxes contend and each frame bills more CPU', () => {
    const plan = chunkPlan(900, Array.from({ length: 900 }, () => 7000));

    expect(plan.count).toBeLessThanOrEqual(32);
    expect(plan.size * 7000).toBeGreaterThan(90_000);
  });

  it('a chunk that would outlive its worker splits further, up to sixty-four', () => {
    const plan = chunkPlan(900, Array.from({ length: 900 }, () => 25_000));

    expect(plan.count).toBeGreaterThan(32);
    expect(plan.count).toBeLessThanOrEqual(64);
  });

  it('a chunk is sized by its heaviest stretch, not by the average', () => {
    const costs = Array.from({ length: 840 }, (_, f) => (f < 120 ? 2500 : 40));

    expect(chunkPlan(840, costs).count).toBeGreaterThan(chunkPlan(840).count);
  });

  it('chunk sizes are even, so a chunk that times out splits in two halves on the same grid', () => {
    expect(chunkPlan(901).size % 2).toBe(0);
    expect(chunkPlan(900, Array.from({ length: 900 }, () => 2500)).size % 2).toBe(0);
  });

  it('the last chunk is allowed to be short, but no chunk is empty', () => {
    const { size, count } = chunkPlan(841);

    expect((count - 1) * size).toBeLessThan(841);
    expect(count * size).toBeGreaterThanOrEqual(841);
  });
});

describe('render progress', () => {
  const start: RenderProgress = { stage: RenderStage.Starting, chunksDone: 0, chunks: 7, totalFrames: 840 };

  it('a chunk landing moves frames done by one chunk', () => {
    const p = advance(advance(start, { kind: 'chunk' }), { kind: 'chunk' });

    expect(p.stage).toBe(RenderStage.Rendering);
    expect(framesDone(p)).toBe(240);
  });

  it('frames done never passes the total, even when the last chunk is short', () => {
    const all = Array.from({ length: 7 }).reduce<RenderProgress>((p) => advance(p, { kind: 'chunk' }), { ...start, totalFrames: 800 });

    expect(framesDone(all)).toBe(800);
  });

  it('assembling and saving come after rendering, and done is final', () => {
    const saving = advance(advance(start, { kind: 'assembling' }), { kind: 'saving' });
    const done = advance(saving, { kind: 'done' });

    expect(saving.stage).toBe(RenderStage.Saving);
    expect(advance(done, { kind: 'chunk' })).toEqual(done);
  });

  it('a failure is final and keeps how far it got', () => {
    const failed = advance(advance(start, { kind: 'chunk' }), { kind: 'failed' });

    expect(failed.stage).toBe(RenderStage.Failed);
    expect(advance(failed, { kind: 'saving' })).toEqual(failed);
    expect(framesDone(failed)).toBe(120);
  });

  it('reads progress back from run params, and nothing usable is null', () => {
    expect(progressOf({ progress: start })).toEqual(start);
    expect(progressOf({ progress: { stage: 'nope' } })).toBeNull();
    expect(progressOf({})).toBeNull();
  });
});

describe('a render that does not move is told to the user', () => {
  const view = (chunksDone: number): RenderView => ({ id: 'r', status: 'running', progress: { stage: RenderStage.Rendering, chunksDone, chunks: 2, totalFrames: 450 }, error: null, assetId: null, credits: 10 });
  const minutes = (n: number) => n * 60_000;

  it('a queue that no tick drives is stuck from the start', () => {
    const watch = watchProgress(null, view(0), 0);

    expect(renderStall({ watch, queue: RenderQueue.Stopped, now: 0 })).toBe(Stall.QueueOff);
  });

  it('a ticking queue is slow only after STALL_AFTER_MS without progress', () => {
    const watch = watchProgress(null, view(0), 0);

    expect(renderStall({ watch, queue: RenderQueue.Ticking, now: STALL_AFTER_MS - 1 })).toBe(Stall.None);
    expect(renderStall({ watch, queue: RenderQueue.Ticking, now: STALL_AFTER_MS })).toBe(Stall.Slow);
  });

  it('a chunk that lands restarts the clock', () => {
    const first = watchProgress(null, view(0), 0);
    const moved = watchProgress(first, view(1), minutes(4));

    expect(renderStall({ watch: moved, queue: RenderQueue.Ticking, now: minutes(8) })).toBe(Stall.None);
    expect(watchProgress(moved, view(1), minutes(9))).toEqual(moved);
  });
});
