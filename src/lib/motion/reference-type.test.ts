import { describe, expect, it } from 'vitest';
import { MotionFormat, motionDocSchema, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { Quality, Severity, docProblems, severityOf } from './direction';
import { LookMiss } from './reference-look';
import { FontClass, Imagery, LetterCase, SmallText, TypeRole, type ReferenceLook, type TypeSpec } from './reference-look-model';
import { MotionStyle } from './style-model';
import { FontCategory, FontSource } from './fonts/model';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const DISPLAY: TypeSpec = { role: TypeRole.Display, font: FontClass.Grotesk, fonts: ['Inter'], weight: 800, case: LetterCase.Lower, tracking: -0.04, leading: 0.82, size: 0.6, align: 'left' };
const LABEL: TypeSpec = { role: TypeRole.Label, font: FontClass.Grotesk, fonts: ['Inter'], weight: 500, case: LetterCase.Upper, tracking: 0.02, leading: 1.1, size: 0.02, align: 'left' };

const LOOK: ReferenceLook = { typeScale: 0.6, bleed: false, columns: 1, smallText: SmallText.Some, palette: ['#000000'], font: FontClass.Grotesk, imagery: Imagery.None, type: [DISPLAY, LABEL] };

type Spec = { id: string; component: 'Title' | 'Text' | 'Shape'; props: Record<string, unknown> };

const INTER = { family: 'Inter', source: FontSource.Google, category: FontCategory.Sans, weights: [400, 500, 800], italic: false, axes: [] };
const SERIF = { ...INTER, family: 'Playfair Display', category: FontCategory.Serif };

const poster = (clips: Spec[], look: ReferenceLook = LOOK) =>
  clips.reduce((doc, c) => must(addClip(doc, { component: c.component, from: 0, durationInFrames: 90, props: c.props }, c.id)), { ...newMotionDoc(MotionFormat.Landscape), style: MotionStyle.Graphic, referenceLook: look, fonts: [INTER, SERIF] } as MotionDoc);

const misses = (doc: MotionDoc) => docProblems(doc, { audioAssets: 1 }).filter((p) => p.kind === Quality.OffLook);
const effects = (doc: MotionDoc) => misses(doc).map((p) => p.effect);

const title = (props: Record<string, unknown> = {}): Spec => ({ id: 'big', component: 'Title', props: { text: 'grid\ntype', font: 'Inter', size: 0.6, weight: 800, tracking: -0.04, leading: 0.82, x: 0.5, y: 0.5, width: 0.9, height: 0.9, ...props } });
const label = (props: Record<string, unknown> = {}): Spec => ({ id: 'lab', component: 'Text', props: { text: 'ZÜRICH\n30 OCT', font: 'Inter', size: 0.02, weight: 500, tracking: 0.02, leading: 1.1, x: 0.8, y: 0.1, width: 0.15, height: 0.05, ...props } });

describe('the typography the references set is measured role by role', () => {
  it('the doc keeps the per-role type spec', () => {
    expect(motionDocSchema.parse(poster([])).referenceLook?.type).toEqual([DISPLAY, LABEL]);
  });

  it('a video set as the references set raises nothing', () => {
    expect(effects(poster([title(), label()]))).toEqual([]);
  });

  it('a serif display title against grotesk references blocks', () => {
    const found = misses(poster([title({ font: 'Playfair Display' }), label()])).find((p) => p.effect === LookMiss.TypeFamily);

    expect(found?.detail).toContain('grotesk');
    expect(severityOf(found!)).toBe(Severity.Blocking);
  });

  it('a wrong family on a small role only warns', () => {
    const found = misses(poster([title(), label({ font: 'Playfair Display' })]));

    expect(found.map((p) => p.effect)).toEqual([LookMiss.TypeFamilySmall]);
    expect(severityOf(found[0])).toBe(Severity.Warning);
  });

  it('a weight off by 100 to 200 warns, by 300 or more blocks', () => {
    expect(effects(poster([title({ weight: 600 }), label()]))).toEqual([LookMiss.TypeWeight]);
    expect(effects(poster([title({ weight: 500 }), label()]))).toEqual([LookMiss.TypeWeightGross]);
    expect(severityOf({ kind: Quality.OffLook, effect: LookMiss.TypeWeightGross, detail: '' })).toBe(Severity.Blocking);
  });

  it('tracking, line height and case outside the measured ones warn', () => {
    expect(effects(poster([title({ tracking: 0.01 }), label()]))).toEqual([LookMiss.TypeTracking]);
    expect(effects(poster([title({ leading: 1.1 }), label()]))).toEqual([LookMiss.TypeLeading]);
    expect(effects(poster([title({ text: 'Grid\nType' }), label()]))).toEqual([LookMiss.TypeCase]);
  });

  it('a text case prop counts as the case of the line', () => {
    expect(effects(poster([title(), label({ text: 'zürich', textCase: 'upper' })]))).toEqual([]);
  });

  it('line height is not judged on a single line', () => {
    expect(effects(poster([title({ text: 'grid', leading: 1.4 }), label()]))).toEqual([]);
  });

  it('a declared role with no text set at its size warns', () => {
    const found = misses(poster([title()])).filter((p) => p.effect === LookMiss.TypeRoleMissing);

    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('label');
  });

  it('hairline rules in the references and none in the video warn', () => {
    const ruled: ReferenceLook = { ...LOOK, rules: { count: 2, thickness: 0.002 } };

    expect(effects(poster([title(), label()], ruled))).toEqual([LookMiss.Rules]);
    expect(effects(poster([title(), label(), { id: 'r', component: 'Shape', props: { width: 0.9, height: 0.002 } }], ruled))).toEqual([]);
  });
});
