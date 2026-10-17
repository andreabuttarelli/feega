import { describe, expect, it } from 'vitest';
import { PaintKind } from './paint-of';
import { gpuEligible, runHtml, runsOf } from './runs';

const layer = (clip: string, kind: PaintKind, blend = 'normal') => ({ clip, paint: { kind }, blend }) as never;

describe('runsOf', () => {
  it('groups neighbouring HTML layers into one texture and leaves natives alone', () => {
    const runs = runsOf([layer('bg', PaintKind.Fill), layer('a', PaintKind.Html), layer('b', PaintKind.Html), layer('img', PaintKind.Image), layer('c', PaintKind.Html)]);

    expect(runs.map((r) => r.clips)).toEqual([['a', 'b'], ['c']]);
    expect(runs.map((r) => r.after)).toEqual([1, 4]);
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

  it('hides every other painted clip and the root backdrop', () => {
    const html = runHtml(page, { clips: ['a'], after: 0, blend: 'normal' }, ['a', 'b', 'bg']);

    expect(html).toContain('[data-clip="b"],[data-clip="bg"]{display:none!important}');
    expect(html).toContain('#root{background:transparent!important}');
    expect(html).not.toContain('[data-clip="a"],');
  });

  it('draws a blended run unblended, the GPU applies the blend', () => {
    expect(runHtml(page, { clips: ['b'], after: 0, blend: 'screen' }, ['b'])).toContain('[data-clip="b"]{mix-blend-mode:normal!important}');
  });
});

describe('gpuEligible', () => {
  const run = { clips: ['a'], after: 0, blend: 'normal' };

  it('takes a doc whose HTML runs fit the WebGL context budget', () => {
    expect(gpuEligible([run, run], 3)).toBe(true);
    expect(gpuEligible([run, run, run], 0)).toBe(true);
  });

  it('hands back to the HTML engine when every run would boot every 3D clip again', () => {
    expect(gpuEligible([run, run, run, run, run, run], 7)).toBe(false);
  });
});
