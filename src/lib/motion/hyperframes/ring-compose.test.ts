// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { flattenComps, precompose } from '../precomp';
import { addClip, setProps, type OpResult } from '../timeline';
import { RING_NUMBERS, ringSliceId, slicesFor } from '../ring/model';
import { baseValue, isAnimatable } from '../keyframes';
import { Unit, unitOf } from '../units';
import { composeHtml } from './compose';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const withComp = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 90 }, 'kpi'));
  doc = must(precompose(doc, ['kpi'], { comp: 'dash', clip: 'pc' }, 'Dashboard'));
  doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== 'pc') })) };
  return { ...doc, durationInFrames: 90 };
})();

type Card = { assetId: string; kind: 'image' | 'video' | 'comp' };

const ring = (media: Card[], count = 3) =>
  must(setProps(must(addClip(withComp, { component: 'Composition', from: 0, durationInFrames: 90 }, 'ring')), 'ring', { layout: 'ring', media, layoutParams: { count } }));

const compose = (doc: MotionDoc, assets: Record<string, string> = {}) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets });

describe('a composition laid out as a ring', () => {
  it('keyframes the ring numbers, read from its layout settings, in their units', () => {
    const doc = ring([], 3);
    const clip = doc.tracks.flatMap((t) => t.clips).find((c) => c.id === 'ring')!;

    expect(isAnimatable('Composition', 'tiltX')).toBe(true);
    expect(baseValue({ ...clip, params: [] } as never, 'ringRadius')).toBe(RING_NUMBERS.ringRadius.fallback);
    expect(unitOf('Composition', 'ringRadius')).toBe(Unit.Px);
    expect(unitOf('Composition', 'backOpacity')).toBe(Unit.Percent);
  });

  it('refuses a card that names a composition the video does not have', () => {
    expect(setProps(ring([]), 'ring', { media: [{ assetId: 'nope', kind: 'comp' }] })).toMatchObject({ ok: false, error: expect.stringContaining('no composition nope') });
  });

  it('refuses a composition whose ring shows itself', () => {
    const doc = ring([{ assetId: 'dash', kind: 'comp' }]);
    const looped = { ...doc, comps: { ...doc.comps, dash: { ...doc.comps.dash, tracks: doc.tracks.filter((t) => t.clips.some((c) => c.id === 'ring')) } } };

    expect(parseMotionDoc(looped)).toMatchObject({ ok: false, error: expect.stringContaining('contains itself') });
  });

  it('slices a card only as finely as its bend shows: no facet strays more than a pixel and a half from the curve', () => {
    for (const [count, radius] of [[4, 600], [6, 600], [12, 300], [24, 1200]]) {
      const facet = (Math.PI * 2) / count / slicesFor(count, radius);
      expect(radius * (1 - Math.cos(facet / 2))).toBeLessThanOrEqual(1.5);
    }
    expect(slicesFor(6, 600)).toBeGreaterThan(slicesFor(12, 600));
    expect(slicesFor(6, 200)).toBeLessThan(slicesFor(6, 800));
  });

  it('plays a composition on every slice of every card that shows it', () => {
    const flat = flattenComps(ring([{ assetId: 'dash', kind: 'comp' }], 3));
    const ids = flat.tracks.flatMap((t) => t.clips.map((c) => c.id));

    expect(ids).toContain(`${ringSliceId('ring', 0, 0)}__0__kpi`);
    expect(ids).toContain(`${ringSliceId('ring', 2, slicesFor(3, RING_NUMBERS.ringRadius.fallback * 1080) - 1)}__0__kpi`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws each slice with its own copy of the card, inside the clip, and no WebGL stage', () => {
    const html = compose(ring([{ assetId: 'dash', kind: 'comp' }, { assetId: 'pic', kind: 'image' }], 2), { pic: 'https://cdn.example/pic.png' });
    const slice = (card: number, s: number) => html.slice(html.indexOf(`id="rg-ring-${card}-${s}"`), html.indexOf(`id="rg-ring-${card}-${s + 1}"`));

    expect(html.indexOf('id="rg-ring-0-0"')).toBeGreaterThan(html.indexOf('data-clip="ring"'));
    expect(slice(0, 0)).toContain(`data-clip="${ringSliceId('ring', 0, 0)}__0__kpi"`);
    expect(slice(0, 1)).toContain(`data-clip="${ringSliceId('ring', 0, 1)}__0__kpi"`);
    expect(slice(1, 0)).toContain('https://cdn.example/pic.png');
    expect(html).toContain('feegaRing');
    expect(html).not.toContain('id="comp-ring"');
  });

  it('keeps the copies inside the slices off their own compositor layers: one layer per clip per slice made a frame cost a second', () => {
    const html = compose(ring([{ assetId: 'dash', kind: 'comp' }], 2));

    expect(html).toContain('.rgs *{will-change:auto!important}');
  });
});
