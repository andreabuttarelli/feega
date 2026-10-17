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
  const DURATION = 10;

  it('takes a doc that needs at most one capture at a time, for under half of its length', () => {
    expect(gpuEligible([run(0, 2), run(5, 7)], [3, 3], DURATION)).toBe(true);
    expect(gpuEligible([], [], DURATION)).toBe(true);
  });

  it('hands back to the HTML engine when two captures overlap, they cost more than the HTML engine', () => {
    expect(gpuEligible([run(0, 2), run(1, 3)], [0, 0], DURATION)).toBe(false);
  });

  it('hands back to the HTML engine when captures cover most of the video, the GPU would only add work', () => {
    expect(gpuEligible([run(0, 6)], [0], DURATION)).toBe(false);
  });

  it('hands back to the HTML engine when the captures need more WebGL contexts than the page has', () => {
    expect(gpuEligible([run(0, 1)], [15], DURATION)).toBe(false);
  });
});
