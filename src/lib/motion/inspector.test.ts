import { describe, expect, it } from 'vitest';
import { COMPONENT_IDS, AssetKind, Control, Group, defaultProps } from './components';
import { Ease } from './design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { fieldGroups, fieldsOf, keyAt, parseDecimal, secondsLabel, valueAt } from './inspector';
import { addClip, setKeyframes, setTransform, type OpResult } from './timeline';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

describe('properties inspector from the component schema', () => {
  it('every component describes every prop it takes', () => {
    for (const id of COMPONENT_IDS) {
      expect(fieldsOf(id).map((f) => f.key).sort()).toEqual(Object.keys(defaultProps(id)).sort());
    }
  });

  it('a colour is a colour picker with its default', () => {
    const color = fieldsOf('Title').find((f) => f.key === 'color');

    expect(color).toMatchObject({ control: Control.Color, fallback: 'brand.text', group: Group.Style });
  });

  it('a range carries its bounds and step', () => {
    const opacity = fieldsOf('Title').find((f) => f.key === 'opacity');

    expect(opacity).toMatchObject({ control: Control.Range, min: 0, max: 1, step: 0.01 });
  });

  it('a select carries its options', () => {
    expect(fieldsOf('Title').find((f) => f.key === 'font')?.options).toEqual(['sans', 'mono']);
  });

  it('the 3D model picker lists only 3D assets', () => {
    expect(fieldsOf('Model3D').find((f) => f.key === 'assetId')).toMatchObject({ control: Control.Asset, assetKind: AssetKind.Model3d });
  });

  it('groups come content first', () => {
    expect(fieldGroups('Title')[0].group).toBe(Group.Content);
  });

  it('seconds read rounded, with a dot, whatever the locale', () => {
    expect(secondsLabel(8)).toBe('0.27');
    expect(secondsLabel(9)).toBe('0.3');
    expect(secondsLabel(90)).toBe('3');
  });

  it('a decimal typed with a comma or a dot is the same number', () => {
    expect(parseDecimal('0,27')).toBe(0.27);
    expect(parseDecimal(' 1.5 ')).toBe(1.5);
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });
});

describe('value at the playhead', () => {
  const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 30, durationInFrames: 90, props: { color: '#000000' } }, 't'));
  const resolve = (v: string) => v;

  it('without keyframes a transform prop shows its base, or the rest value', () => {
    const clip = findClip(must(setTransform(doc, 't', { rotateY: 40 })), 't')!.clip;

    expect(valueAt(clip, 'rotateY', 50, resolve)).toBe(40);
    expect(valueAt(clip, 'scale', 50, resolve)).toBe(1);
  });

  it('with keyframes it shows the interpolated value at the playhead, in timeline frames', () => {
    const keyed = must(setKeyframes(doc, 't', 'rotateX', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 20, value: 100, ease: Ease.Linear }]));

    expect(valueAt(findClip(keyed, 't')!.clip, 'rotateX', 40, resolve)).toBe(50);
  });

  it('a colour without keyframes shows its prop, with keyframes the mix', () => {
    const keyed = must(setKeyframes(doc, 't', 'color', [{ frame: 0, value: '#000000', ease: Ease.Linear }, { frame: 10, value: '#ffffff', ease: Ease.Linear }]));

    expect(valueAt(findClip(doc, 't')!.clip, 'color', 0, resolve)).toBe('#000000');
    expect(valueAt(findClip(keyed, 't')!.clip, 'color', 35, resolve)).toBe('#808080');
  });

  it('a 3D camera without keyframes shows the value its props imply', () => {
    const model = findClip(must(addClip(doc, { component: 'Model3D', from: 0, props: { zoom: 1.5, startAngle: 10 } }, 'm')), 'm')!.clip;

    expect(valueAt(model, 'dolly', 0, resolve)).toBe(1.5);
    expect(valueAt(model, 'orbit', 0, resolve)).toBe(10);
    expect(valueAt(model, 'fov', 0, resolve)).toBe(35);
  });

  it('knows whether a keyframe sits exactly on the playhead', () => {
    const keyed = findClip(must(setKeyframes(doc, 't', 'rotateX', [{ frame: 5, value: 0, ease: Ease.Linear }])), 't')!.clip;

    expect(keyAt(keyed, 'rotateX', 35)).toBe(true);
    expect(keyAt(keyed, 'rotateX', 36)).toBe(false);
  });
});
