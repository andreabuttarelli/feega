import { describe, expect, it } from 'vitest';
import { PaintKind } from './paint-of';
import { gpuEligible, runHtml, runsOf } from './runs';

const layer = (clip: string, kind: PaintKind, blend = 'normal') => ({ clip, paint: { kind }, blend, windows: [[0, 1]] }) as never;

describe('runsOf', () => {
  it('groups neighbouring HTML layers into one texture and leaves natives alone', () => {
    const runs = runsOf([layer('bg', PaintKind.Fill), layer('a', PaintKind.Html), layer('b', PaintKind.Html), layer('img', PaintKind.Image), layer('c', PaintKind.Html)]);

    expect(runs.map((r) => r.clips)).toEqual([['a', 'b'], ['c']]);
    expect(runs.map((r) => r.after)).toEqual([1, 4]);
    expect(runs[0].span).toEqual([0, 1]);
  });

  it('keeps a blended HTML layer in a run of its own so the GPU can blend it', () => {
    const runs = runsOf([layer('a', PaintKind.Html), layer('b', PaintKind.Html, 'screen'), layer('c', PaintKind.Html)]);

    expect(runs.map((r) => [r.clips, r.blend])).toEqual([
      [['a'], 'normal'],
      [['b'], 'screen'],
      [['c'], 'normal']
    ]);
  });
});

describe('runHtml', () => {
  const page = '<html><head></head><body><div id="root"></div></body></html>';

  it('drops the root backdrop, the GPU draws it', () => {
    const html = runHtml(page, { clips: ['a'], after: 0, blend: 'normal', span: [0, 1] });

    expect(html).toContain('#root{background:transparent!important}');
  });

  it('draws a blended run unblended, the GPU applies the blend', () => {
    expect(runHtml(page, { clips: ['b'], after: 0, blend: 'screen', span: [0, 1] })).toContain('[data-clip="b"]{mix-blend-mode:normal!important}');
  });
});

describe('gpuEligible', () => {
  const run = (from: number, to: number) => ({ clips: ['a'], after: 0, blend: 'normal', span: [from, to] as [number, number] });

  it('takes a doc that never needs more than two captures at once', () => {
    expect(gpuEligible([run(0, 1), run(0, 1)], [3, 3])).toBe(true);
    expect(gpuEligible([run(0, 1), run(1, 2), run(2, 3), run(3, 4)], [0, 0, 0, 0])).toBe(true);
    expect(gpuEligible([], [])).toBe(true);
  });

  it('hands back to the HTML engine when three captures overlap, they cost more than the HTML engine', () => {
    expect(gpuEligible([run(0, 2), run(1, 3), run(1.5, 2)], [0, 0, 0])).toBe(false);
  });

  it('hands back to the HTML engine when overlapping captures need more WebGL contexts than the page has', () => {
    expect(gpuEligible([run(0, 1), run(0, 1)], [7, 7])).toBe(false);
    expect(gpuEligible([run(0, 1), run(1, 2)], [7, 7])).toBe(true);
  });
});
