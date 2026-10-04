import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, type OpResult } from '../timeline';
import { Ease } from '../design';
import { ModifierKind } from './modifiers';
import { addModifier, morphTo, removeModifier, setModifier, setPath, shapePath } from './ops';
import { ShapeKind } from './schema';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'star' } }, 's'));
const props = (d: MotionDoc) => findClip(d, 's')!.clip.props as Record<string, unknown>;

describe('shape ops', () => {
  it('set_path turns the clip into a free path, and refuses what is not path data', () => {
    expect(props(must(setPath(doc, 's', 'M0 0L1 1Z')))).toMatchObject({ shape: 'path', path: 'M0 0L1 1Z' });
    expect(setPath(doc, 's', '<script>').ok).toBe(false);
  });

  it('a parametric shape writes itself as path data, so the pen tool can edit it', () => {
    expect(shapePath({ shape: ShapeKind.Rect, roundness: 0, sides: 6, points: 5, innerRadius: 0.5 })).toBe('M0 0L1 0L1 1L0 1Z');
  });

  it('morph_to appends a target and keys the morph across the given frames', () => {
    const morphed = must(morphTo(doc, 's', { path: 'M0 0L1 0L1 1L0 1Z', from: 0, to: 30 }));
    expect(props(morphed).morphs).toEqual(['M0 0L1 0L1 1L0 1Z']);
    const track = findClip(morphed, 's')!.clip.keyframes.morph;
    expect(track.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [30, 1]
    ]);
    const twice = must(morphTo(morphed, 's', { kind: ShapeKind.Ellipse, from: 30, to: 50 }));
    expect(findClip(twice, 's')!.clip.keyframes.morph.map((k) => k.value)).toEqual([0, 1, 2]);
  });

  it('modifiers stack, change and leave with their keyframes', () => {
    const one = must(addModifier(doc, 's', ModifierKind.Trim, 't', { end: 0.5 }));
    expect(props(one).modifiers).toEqual([{ id: 't', kind: 'trim', enabled: true, params: { end: 0.5 } }]);
    const keyed = must(setKeyframes(one, 's', 'mod.t.end', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 10, value: 1, ease: Ease.Linear }]));
    const changed = must(setModifier(keyed, 's', 't', { params: { start: 0.1 }, enabled: false }));
    expect(props(changed).modifiers).toEqual([{ id: 't', kind: 'trim', enabled: false, params: { end: 0.5, start: 0.1 } }]);
    const gone = must(removeModifier(changed, 's', 't'));
    expect(props(gone).modifiers).toEqual([]);
    expect(findClip(gone, 's')!.clip.keyframes['mod.t.end']).toBeUndefined();
  });

  it('a param out of range or unknown is refused with the reason', () => {
    const bad = addModifier(doc, 's', ModifierKind.Trim, 't', { nope: 1 });
    expect(bad.ok ? '' : bad.error).toContain('trim has no nope');
  });
});
