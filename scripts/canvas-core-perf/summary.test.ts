import { describe, expect, it } from 'vitest';
import { comparison, summarise } from './summary';

const raw = {
  inputs: [
    { input: 10, paint: 18 },
    { input: 20, paint: 60 }
  ],
  frames: [16, 17, 16, 50],
  firstPaintMs: 900,
  heapBytes: 50 * 1024 * 1024
};

describe('core perf summary', () => {
  it('reduces a run to the four numbers that are compared', () => {
    expect(summarise(raw)).toEqual({ inputP95: 40, frameP95: 50, firstPaintMs: 900, heapMb: 50 });
  });

  it('an engine without a heap reading reports it as missing, not zero', () => {
    expect(summarise({ ...raw, heapBytes: null }).heapMb).toBeNull();
  });

  it('prints one row per renderer and browser', () => {
    const table = comparison([
      { browser: 'chromium', renderer: 'gpu', summary: summarise(raw) },
      { browser: 'chromium', renderer: 'core', summary: summarise({ ...raw, heapBytes: null }) }
    ]);
    expect(table).toContain('| chromium | gpu | 40 | 50 | 900 | 50 |');
    expect(table).toContain('| chromium | core | 40 | 50 | 900 | n/a |');
  });
});
