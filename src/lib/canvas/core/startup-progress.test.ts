import { describe, expect, it } from 'vitest';
import { StartupStep } from './startup-marks';
import { CanvasContent, startupProgress } from './startup-progress';

describe('startupProgress', () => {
  it('starts at zero', () => {
    expect(startupProgress(new Set())).toBe(0);
  });

  it('grows with each milestone reached', () => {
    const some = startupProgress(new Set([StartupStep.PageData, StartupStep.WasmReady]));
    const more = startupProgress(new Set([StartupStep.PageData, StartupStep.WasmReady, StartupStep.SourcesArrived]));
    expect(some).toBeGreaterThan(0);
    expect(more).toBeGreaterThan(some);
  });

  it('is complete once the first frame is drawn', () => {
    expect(startupProgress(new Set([StartupStep.FirstDrawn]))).toBe(1);
  });
});

describe('startupProgress on a canvas without frames', () => {
  it('is complete once the renderer mounts', () => {
    expect(startupProgress(new Set([StartupStep.Mounted]), CanvasContent.Empty)).toBe(1);
  });
});
