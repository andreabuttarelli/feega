import { describe, expect, it } from 'vitest';
import { StartupStep } from './startup-marks';
import { CanvasContent, Reveal, revealDue, revealOf, startupProgress } from './startup-progress';

const none = { shown: 0, total: 0 };

describe('startupProgress', () => {
  it('starts at zero', () => {
    expect(startupProgress(new Set(), none)).toBe(0);
  });

  it('grows with each milestone reached', () => {
    const some = startupProgress(new Set([StartupStep.PageData, StartupStep.WasmReady]), none);
    const more = startupProgress(new Set([StartupStep.PageData, StartupStep.WasmReady, StartupStep.SourcesArrived]), none);
    expect(some).toBeGreaterThan(0);
    expect(more).toBeGreaterThan(some);
  });

  it('grows with each on-screen frame that shows content', () => {
    const steps = new Set([StartupStep.PageData, StartupStep.SourcesArrived]);
    const one = startupProgress(steps, { shown: 1, total: 4 });
    const three = startupProgress(steps, { shown: 3, total: 4 });
    expect(three).toBeGreaterThan(one);
    expect(three).toBeLessThan(1);
  });

  it('stays below complete while the first frame is drawn but others are still white', () => {
    expect(startupProgress(new Set([StartupStep.FirstDrawn]), { shown: 1, total: 4 })).toBeLessThan(1);
  });

  it('is complete once every on-screen frame shows content', () => {
    expect(startupProgress(new Set([StartupStep.AllShown]), { shown: 4, total: 4 })).toBe(1);
  });
});

describe('startupProgress on a canvas without frames', () => {
  it('is complete once the renderer mounts', () => {
    expect(startupProgress(new Set([StartupStep.Mounted]), none, CanvasContent.Empty)).toBe(1);
  });
});

describe('revealDue', () => {
  it('waits up to 8 s after the engine is ready for frames and their breakpoint views to fill', () => {
    expect(revealDue({ sinceStartMs: 9_000, sinceEngineMs: 7_999 })).toBe(false);
    expect(revealDue({ sinceStartMs: 9_000, sinceEngineMs: 8_000 })).toBe(true);
  });

  it('gives up 12 s after start even when the engine never becomes ready', () => {
    expect(revealDue({ sinceStartMs: 11_999, sinceEngineMs: null })).toBe(false);
    expect(revealDue({ sinceStartMs: 12_000, sinceEngineMs: null })).toBe(true);
  });
});

describe('revealing early on the frames nearest the centre', () => {
  const ready = new Set([StartupStep.GpuReady]);

  it('reveals once the engine is ready and the nearest frames show something, though others still load (stress36 kept the splash 9 s over frames drawn at 2.5 s)', () => {
    expect(startupProgress(ready, { shown: 6, total: 36, nearShown: 6, nearTotal: 6 }, CanvasContent.Frames, Reveal.Early)).toBe(1);
  });

  it('keeps the splash while a nearest frame is still empty', () => {
    expect(startupProgress(ready, { shown: 5, total: 36, nearShown: 5, nearTotal: 6 }, CanvasContent.Frames, Reveal.Early)).toBeLessThan(1);
  });

  it('keeps the splash before the engine is ready', () => {
    expect(startupProgress(new Set(), { shown: 6, total: 36, nearShown: 6, nearTotal: 6 }, CanvasContent.Frames, Reveal.Early)).toBeLessThan(1);
  });

  it('waits for every on-screen frame when asked to reveal all', () => {
    expect(startupProgress(ready, { shown: 6, total: 36, nearShown: 6, nearTotal: 6 }, CanvasContent.Frames, Reveal.All)).toBeLessThan(1);
  });

  it('reads the choice from the address, early unless told all', () => {
    expect(revealOf(null)).toBe(Reveal.Early);
    expect(revealOf('all')).toBe(Reveal.All);
    expect(revealOf('nonsense')).toBe(Reveal.Early);
  });
});
