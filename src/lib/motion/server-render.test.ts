import { describe, expect, it } from 'vitest';
import { RenderStage, chunkPlan, progressOf, advance, framesDone, type RenderProgress } from './server-render';

describe('chunkPlan', () => {
  it('splits a 28 s trailer into seven 120-frame chunks', () => {
    expect(chunkPlan(840)).toEqual({ size: 120, count: 7 });
  });

  it('never asks for more than eight sandboxes: a long video gets bigger chunks', () => {
    expect(chunkPlan(3000)).toEqual({ size: 375, count: 8 });
  });

  it('a clip shorter than one chunk is one chunk', () => {
    expect(chunkPlan(45)).toEqual({ size: 45, count: 1 });
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
