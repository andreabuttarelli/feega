// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { flattenComps, precompose } from '../precomp';
import { addClip, setProps, type OpResult } from '../timeline';
import { CardKind, SLICES_PER_CARD, ringSliceId } from '../ring/model';
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

const ring = (cards: { kind: CardKind; ref: string }[], count = 3) =>
  must(setProps(must(addClip(withComp, { component: 'Ring', from: 0, durationInFrames: 90 }, 'ring')), 'ring', { cards, count }));

const compose = (doc: MotionDoc, assets: Record<string, string> = {}) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets });

describe('a ring of cards', () => {
  it('is a clip with keyframable shape, motion, look and camera', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Ring', from: 0, durationInFrames: 90 }, 'ring'));

    expect(parseMotionDoc(doc).ok).toBe(true);
    expect(unitOf('Ring', 'ringRadius')).toBe(Unit.Px);
    expect(unitOf('Ring', 'tiltX')).toBe(Unit.Degrees);
    expect(unitOf('Ring', 'backOpacity')).toBe(Unit.Percent);
  });

  it('refuses a card that names a composition the video does not have', () => {
    const doc = ring([]);

    expect(setProps(doc, 'ring', { cards: [{ kind: CardKind.Comp, ref: 'nope' }] })).toMatchObject({ ok: false, error: expect.stringContaining('no composition nope') });
  });

  it('refuses a composition whose ring shows itself', () => {
    const doc = ring([{ kind: CardKind.Comp, ref: 'dash' }]);
    const looped = { ...doc, comps: { ...doc.comps, dash: { ...doc.comps.dash, tracks: doc.tracks.filter((t) => t.clips.some((c) => c.id === 'ring')) } } };

    expect(parseMotionDoc(looped)).toMatchObject({ ok: false, error: expect.stringContaining('contains itself') });
  });

  it('plays a composition on every slice of every card that shows it', () => {
    const flat = flattenComps(ring([{ kind: CardKind.Comp, ref: 'dash' }], 3));
    const ids = flat.tracks.flatMap((t) => t.clips.map((c) => c.id));

    expect(ids).toContain(`${ringSliceId('ring', 0, 0)}__0__kpi`);
    expect(ids).toContain(`${ringSliceId('ring', 2, SLICES_PER_CARD - 1)}__0__kpi`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('draws each slice with its own copy of the card, inside the ring', () => {
    const html = compose(ring([{ kind: CardKind.Comp, ref: 'dash' }, { kind: CardKind.Image, ref: 'pic' }], 2), { pic: 'https://cdn.example/pic.png' });
    const slice = (card: number, s: number) => html.slice(html.indexOf(`id="rg-ring-${card}-${s}"`), html.indexOf(`id="rg-ring-${card}-${s + 1}"`));

    expect(html.indexOf('id="rg-ring-0-0"')).toBeGreaterThan(html.indexOf('data-clip="ring"'));
    expect(slice(0, 0)).toContain(`data-clip="${ringSliceId('ring', 0, 0)}__0__kpi"`);
    expect(slice(0, 1)).toContain(`data-clip="${ringSliceId('ring', 0, 1)}__0__kpi"`);
    expect(slice(1, 0)).toContain('https://cdn.example/pic.png');
    expect(html).toContain('feegaRing');
  });

  it('shows an empty card when nothing is picked yet', () => {
    const html = compose(ring([], 4));

    expect(html).toContain(`id="rg-ring-3-${SLICES_PER_CARD - 1}"`);
  });
});
