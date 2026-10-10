import { describe, expect, test } from 'vitest';
import { beatAlignment, compareRuns, docCuts, edgeDensity, emptyShare, gateBlockingLeft, holdStats, spentUsd, textMinShare, toolErrors, uiLayers, type CaseResult } from './score';

const flat = (w: number, h: number, v: number) => new Uint8Array(w * h).fill(v);

describe('edgeDensity', () => {
  test('a flat frame has no edges', () => {
    expect(edgeDensity(flat(8, 8, 40), 8, 8)).toBe(0);
  });

  test('a hard vertical line counts its edge pixels', () => {
    const px = flat(10, 10, 0);
    for (let y = 0; y < 10; y++) {
      px[y * 10 + 5] = 255;
    }
    expect(edgeDensity(px, 10, 10)).toBeCloseTo(0.2, 5);
  });
});

describe('emptyShare', () => {
  test('counts frames under the threshold', () => {
    expect(emptyShare([0, 0.001, 0.2, 0.5], 0.01)).toBe(0.5);
  });

  test('no frames is null, not zero', () => {
    expect(emptyShare([], 0.01)).toBeNull();
  });
});

describe('holdStats', () => {
  test('cuts split the video into holds', () => {
    expect(holdStats([2, 6], 10)).toEqual({ scenes: 3, meanHold: 10 / 3, maxHold: 4 });
  });

  test('no cut is one scene as long as the video', () => {
    expect(holdStats([], 7)).toEqual({ scenes: 1, meanHold: 7, maxHold: 7 });
  });

  test('cuts outside the video are ignored', () => {
    expect(holdStats([0, 5, 12], 10)).toEqual({ scenes: 2, meanHold: 5, maxHold: 5 });
  });
});

describe('beatAlignment', () => {
  test('share of cuts within tolerance of a beat', () => {
    expect(beatAlignment([1.02, 2.3, 3], [1, 2, 3], 0.1)).toBeCloseTo(2 / 3, 5);
  });

  test('no beats or no cuts is null', () => {
    expect(beatAlignment([1], [], 0.1)).toBeNull();
    expect(beatAlignment([], [1], 0.1)).toBeNull();
  });
});

const doc = (clips: Array<{ component: string; props?: Record<string, unknown> }>) => ({ height: 1080, tracks: [{ kind: 'visual', clips }] });

describe('docCuts', () => {
  test('starts of top-level visual clips after zero, in seconds, deduplicated', () => {
    const d = {
      fps: 30,
      tracks: [
        { kind: 'visual', clips: [{ component: 'Title', from: 0 }, { component: 'Title', from: 60 }] },
        { kind: 'visual', clips: [{ component: 'Custom', from: 60 }, { component: 'Shape', from: 90, parent: 'x' }] },
        { kind: 'audio', clips: [{ component: 'Audio', from: 30 }] }
      ]
    };
    expect(docCuts(d)).toEqual([2]);
  });
});

describe('textMinShare', () => {
  test('smallest text size among text components, defaults when unset', () => {
    expect(textMinShare(doc([{ component: 'Title', props: { size: 0.08 } }, { component: 'Text' }, { component: 'Shape', props: { size: 0.001 } }]))).toBe(0.04);
  });

  test('no text is null', () => {
    expect(textMinShare(doc([{ component: 'Shape' }]))).toBeNull();
  });
});

describe('uiLayers', () => {
  test('splits custom UI clips into kit pieces and recreated ones', () => {
    const d = doc([{ component: 'Custom', props: { name: 'UiPromptBox' } }, { component: 'Custom', props: { name: 'UiAcmeEditor' } }, { component: 'Title' }]);
    expect(uiLayers(d, new Set(['UiPromptBox']))).toEqual({ recreated: 1, kit: 1 });
  });
});

const call = (toolName: string, output: unknown, status = 'done') => ({ toolName, output, status });

describe('gateBlockingLeft', () => {
  test('reads blocking from the last view_frames', () => {
    const messages = [{ tool_calls: [call('view_frames', { ok: true, blocking: ['a', 'b'] })] }, { tool_calls: [call('set_timing', { ok: true }), call('view_frames', { ok: true, blocking: ['c'] })] }];
    expect(gateBlockingLeft(messages)).toBe(1);
  });

  test('never looked is null', () => {
    expect(gateBlockingLeft([{ tool_calls: [call('add_clip', { ok: true })] }])).toBeNull();
  });
});

describe('toolErrors', () => {
  test('counts refused and failed tool calls', () => {
    expect(toolErrors([{ tool_calls: [call('a', { ok: false }), call('b', { ok: true }), call('c', null, 'error')] }, { tool_calls: null }])).toBe(2);
  });
});

describe('spentUsd', () => {
  test('sums cost_usd, treating null as zero', () => {
    expect(spentUsd([{ cost_usd: 0.5 }, { cost_usd: null }, { cost_usd: '0.25' }])).toBe(0.75);
  });
});

const result = (name: string, duration: number | null): CaseResult => ({ name, prompt: '', unrun: null, facts: { duration } as CaseResult['facts'], taste: null });

describe('compareRuns', () => {
  test('numeric deltas per case and fact', () => {
    expect(compareRuns([result('a', 20)], [result('a', 30)])).toEqual({ a: { duration: -10 } });
  });

  test('a case missing before has no deltas', () => {
    expect(compareRuns([result('a', 20)], [])).toEqual({ a: {} });
  });
});
