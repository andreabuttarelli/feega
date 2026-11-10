import { describe, expect, it } from 'vitest';
import { StartupStep, resourceSpans, startupMarks } from './startup-marks';

describe('startup marks', () => {
  it('orders the startup marks by time and ignores the others', () => {
    const marks = [
      { name: 'startup|gpu-ready', startTime: 700.4 },
      { name: 'frame|asked|a', startTime: 10 },
      { name: 'startup|sources-asked', startTime: 350.6 }
    ];
    expect(startupMarks(marks)).toEqual([
      { step: StartupStep.SourcesAsked, at: 351 },
      { step: StartupStep.GpuReady, at: 700 }
    ]);
  });

  it('spans every resource of a kind from its first start to its last end', () => {
    const resources = [
      { name: 'http://x/p/1/c/2/motion/sources?ids=a', startTime: 400, responseEnd: 500 },
      { name: 'http://x/p/1/c/2/motion/sources?ids=b', startTime: 420, responseEnd: 650 },
      { name: 'http://x/gpu-core/gpu_core_bg.wasm', startTime: 90, responseEnd: 300 }
    ];
    expect(resourceSpans(resources)).toEqual([
      { step: 'wasm-fetch', start: 90, end: 300 },
      { step: 'sources-fetch', start: 400, end: 650 }
    ]);
  });
});
