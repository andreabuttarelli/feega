import { describe, expect, it } from 'vitest';
import { FillType, fillsSchema, type Fill } from './model';
import { Source, ValueKind } from '../keyframes';
import { MotionFormat, newMotionDoc } from '../doc';
import { Ease } from '../design';
import { addClip, setKeyframes } from '../timeline';
import { keyLanes } from '../timeline-view';
import { withParams } from '../custom/params';
import { applyFillKeys, fillKey, fillOfKey, fillProps, FillField, splitFillEdit } from './keys';

const stack = (raw: unknown[]): Fill[] => fillsSchema.parse(raw);
const linear = stack([{ type: FillType.Linear, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }], angle: 90 }]);
const radial = stack([{ type: FillType.Radial, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] }]);

describe('fill keyframe keys', () => {
  it('a key names the fill, the stop and the field it animates', () => {
    expect(fillOfKey(fillKey(2, FillField.StopColor, 1))).toEqual({ index: 2, field: FillField.StopColor, stop: 1 });
    expect(fillOfKey(fillKey(0, FillField.Angle))).toEqual({ index: 0, field: FillField.Angle });
    expect(fillOfKey('opacity')).toBeNull();
    expect(fillOfKey('fill.0.stop.x.color')).toBeNull();
  });

  it('a linear fill offers stop colours, stop positions and angle', () => {
    const props = fillProps(linear);
    expect(props.map((p) => p.key)).toEqual(['fill.0.stop.0.color', 'fill.0.stop.0.pos', 'fill.0.stop.1.color', 'fill.0.stop.1.pos', 'fill.0.angle']);
    expect(props[0]).toMatchObject({ kind: ValueKind.Color, source: Source.Fill, base: '#000000' });
    expect(props[3]).toMatchObject({ kind: ValueKind.Number, min: 0, max: 1, base: 1 });
  });

  it('a radial fill offers its centre and radius', () => {
    expect(fillProps(radial).map((p) => p.key)).toEqual(expect.arrayContaining(['fill.0.cx', 'fill.0.cy', 'fill.0.radius']));
  });

  it('sampled values replace the stored ones without touching the rest', () => {
    const next = applyFillKeys(radial, { 'fill.0.stop.1.color': '#ff0000', 'fill.0.stop.0.pos': 0.25, 'fill.0.cx': 0.8, 'fill.0.radius': 2 });
    expect(next[0]).toMatchObject({ stops: [{ color: '#000000', pos: 0.25 }, { color: '#ff0000', pos: 1 }], center: { x: 0.8, y: 0.5 }, radius: 2 });
    expect(radial[0]).toMatchObject({ radius: 1 });
  });

  it('a key for a fill or stop that is gone is ignored', () => {
    expect(applyFillKeys(linear, { 'fill.3.angle': 10, 'fill.0.stop.9.pos': 0.1 })).toEqual(linear);
  });

  describe('editing a stack whose gradient is animated', () => {
    const keyed = new Set(['fill.0.stop.1.color']);
    const shown = applyFillKeys(linear, { 'fill.0.stop.1.color': '#808080' });
    const redder = applyFillKeys(shown, { 'fill.0.stop.1.color': '#ff0000', 'fill.0.angle': 45 });

    it('a keyed value goes to the keyframe and leaves the stored one alone', () => {
      const { fills, keyedValues } = splitFillEdit(linear, shown, redder, keyed);

      expect(keyedValues).toEqual({ 'fill.0.stop.1.color': '#ff0000' });
      expect(fills[0]).toMatchObject({ angle: 45, stops: [{ color: '#000000' }, { color: '#ffffff' }] });
    });

    it('adding a stop rewrites the stack and moves no keyframe', () => {
      const added = [{ ...linear[0], stops: [...(linear[0] as { stops: unknown[] }).stops, { color: '#00ff00', pos: 0.5 }] }] as Fill[];
      const { fills, keyedValues } = splitFillEdit(linear, shown, added, keyed);

      expect(keyedValues).toEqual({});
      expect(fills).toEqual(added);
    });
  });

  describe('on a shape clip', () => {
    const base = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', fills: linear } }, 'card');
    const doc = base.ok ? base.doc : newMotionDoc(MotionFormat.Landscape);
    const track = [{ frame: 0, value: 0.2, ease: Ease.Linear }, { frame: 30, value: 0.8, ease: Ease.Linear }];

    it('accepts keyframes on a stop position and lists the lane in the timeline', () => {
      const keyed = setKeyframes(doc, 'card', 'fill.0.stop.0.pos', track);
      const clip = keyed.ok ? keyed.doc.tracks[0].clips[0] : null;

      expect(keyed.ok).toBe(true);
      expect(keyLanes(withParams(doc, clip!)).map((l) => l.prop)).toContain('fill.0.stop.0.pos');
    });

    it('refuses a key for a fill the clip does not have', () => {
      const keyed = setKeyframes(doc, 'card', 'fill.4.angle', track);

      expect(keyed.ok).toBe(false);
    });

    it('refuses a colour key that is not a colour', () => {
      const keyed = setKeyframes(doc, 'card', 'fill.0.stop.0.color', [{ frame: 0, value: 'nope', ease: Ease.Linear }]);

      expect(keyed.ok).toBe(false);
    });
  });
});
