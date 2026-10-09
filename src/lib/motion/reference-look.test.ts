import { describe, expect, it } from 'vitest';
import { MotionFormat, motionDocSchema, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { Quality, Severity, docProblems, severityOf } from './direction';
import { LookMiss } from './reference-look';
import { FontClass, Imagery, SmallText, type ReferenceLook } from './reference-look-model';
import { MotionStyle } from './style-model';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const SWISS: ReferenceLook = { typeScale: 0.8, bleed: true, columns: 3, smallText: SmallText.Dense, palette: ['#e30613', '#0a0a0a', '#f2f0eb'], font: FontClass.Grotesk, imagery: Imagery.Shapes };

const poster = (look: ReferenceLook | undefined, clips: { id: string; component: 'Title' | 'Text'; props: Record<string, unknown> }[]) =>
  clips.reduce((doc, c) => must(addClip(doc, { component: c.component, from: 0, durationInFrames: 90, props: c.props }, c.id)), { ...newMotionDoc(MotionFormat.Landscape), style: MotionStyle.Graphic, referenceLook: look } as MotionDoc);

const misses = (doc: MotionDoc, referencesSeen = false) => docProblems(doc, { audioAssets: 1, referencesSeen }).filter((p) => p.kind === Quality.OffLook);

const small = (id: string) => ({ id, component: 'Text' as const, props: { text: 'Raster\nKontrast\nOrdnung', size: 0.02, x: 0.8, y: 0.8, width: 0.15, height: 0.1 } });

const giant = (size: number, bleed: Record<string, unknown> = {}) => ({ id: 'big', component: 'Title' as const, props: { text: 'FORM', size, x: 0.5, y: 0.5, width: 0.8, height: 0.9, ...bleed } });

describe('the look the references set is measured against the video', () => {
  it('the doc keeps the look recorded from the references', () => {
    const parsed = motionDocSchema.parse(poster(SWISS, []));

    expect(parsed.referenceLook).toEqual(SWISS);
  });

  it('references looked at but no look recorded blocks delivery', () => {
    const found = misses(poster(undefined, [giant(0.3)]), true);

    expect(found.map((p) => p.effect)).toEqual([LookMiss.Unrecorded]);
    expect(severityOf(found[0])).toBe(Severity.Blocking);
  });

  it('no references and no look: nothing to measure', () => {
    expect(misses(poster(undefined, [giant(0.3)]))).toEqual([]);
  });

  it('giant type in the references, a title a third of the size: a gross miss that blocks', () => {
    const found = misses(poster(SWISS, [giant(0.3, { x: 0.9 }), small('a'), small('b'), small('c')])).find((p) => p.effect === LookMiss.TypeScaleGross);

    expect(found?.detail).toContain('0.8');
    expect(severityOf(found!)).toBe(Severity.Blocking);
  });

  it('a title close to the target but still short only warns', () => {
    const effects = misses(poster(SWISS, [giant(0.5, { x: 0.9 }), small('a'), small('b'), small('c')])).map((p) => p.effect);

    expect(effects).toEqual([LookMiss.TypeScale]);
    expect(severityOf({ kind: Quality.OffLook, effect: LookMiss.TypeScale, detail: '' })).toBe(Severity.Warning);
  });

  it('a scale keyframe counts toward the type size', () => {
    const doc = poster(SWISS, [giant(0.4, { x: 0.9 }), small('a'), small('b'), small('c')]);
    const grown = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'big' ? { ...c, keyframes: { scale: [{ frame: 0, value: 1, ease: 'linear' }, { frame: 30, value: 2, ease: 'linear' }] } } : c)) })) } as MotionDoc;

    expect(misses(grown)).toEqual([]);
  });

  it('bleeding type in the references and nothing running off the edge blocks', () => {
    const found = misses(poster(SWISS, [giant(0.8), small('a'), small('b'), small('c')]));

    expect(found.map((p) => p.effect)).toEqual([LookMiss.Bleed]);
    expect(severityOf(found[0])).toBe(Severity.Blocking);
  });

  it('a title that runs past the frame edge, or is declared bleed, satisfies the bleed', () => {
    const past = poster(SWISS, [giant(0.8, { x: 0.9 }), small('a'), small('b'), small('c')]);
    const declared = poster(SWISS, [giant(0.8), small('a'), small('b'), small('c')]);
    const flagged = { ...declared, tracks: declared.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'big' ? { ...c, bleed: true } : c)) })) };

    expect(misses(past)).toEqual([]);
    expect(misses(flagged)).toEqual([]);
  });

  it('columns of small text in the references and none in the video blocks', () => {
    const found = misses(poster(SWISS, [giant(0.8, { x: 0.9 })]));

    expect(found.map((p) => p.effect)).toEqual([LookMiss.NoSmallText]);
    expect(severityOf(found[0])).toBe(Severity.Blocking);
  });

  it('fewer small-text blocks than the columns only warns', () => {
    const found = misses(poster(SWISS, [giant(0.8, { x: 0.9 }), small('a')]));

    expect(found.map((p) => p.effect)).toEqual([LookMiss.Columns]);
    expect(severityOf(found[0])).toBe(Severity.Warning);
  });
});
