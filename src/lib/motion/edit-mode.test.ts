import { describe, expect, it } from 'vitest';
import { Ease } from '@feega/motion-core/motion/design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setKeyframes, type OpResult } from '@feega/motion-core/motion/timeline';
import { EDIT_MODE_KEY, EditMode, designWarning, editIn, nextMode, readMode, recalledMode, rememberMode } from './edit-mode';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 30, durationInFrames: 90 }, 't'));
const clipOf = (d: MotionDoc) => findClip(d, 't')!.clip;
const keyed = must(
  setKeyframes(doc, 't', 'rotateY', [
    { frame: 0, value: 0, ease: Ease.Linear },
    { frame: 40, value: 40, ease: Ease.Linear }
  ])
);

describe('Design and Motion modes', () => {
  it('Motion writes a keyframe at the playhead on an animated prop', () => {
    const next = must(editIn(EditMode.Motion, keyed, clipOf(keyed), 'rotateY', 90, 50));

    expect(clipOf(next).keyframes.rotateY.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [20, 90],
      [40, 40]
    ]);
  });

  it('Design never adds a keyframe: it moves the whole animation by the change', () => {
    const next = must(editIn(EditMode.Design, keyed, clipOf(keyed), 'rotateY', 30, 50));

    expect(clipOf(next).keyframes.rotateY.map((k) => [k.frame, k.value])).toEqual([
      [0, 10],
      [40, 50]
    ]);
  });

  it('Design sets every keyframe of an animated colour, which has no offset', () => {
    const coloured = must(
      setKeyframes(doc, 't', 'color', [
        { frame: 0, value: '#000000', ease: Ease.Linear },
        { frame: 40, value: '#ffffff', ease: Ease.Linear }
      ])
    );
    const next = must(editIn(EditMode.Design, coloured, clipOf(coloured), 'color', '#ff0000', 50));

    expect(clipOf(next).keyframes.color.map((k) => k.value)).toEqual(['#ff0000', '#ff0000']);
  });

  it('both modes write the base of a prop that is not animated', () => {
    for (const mode of [EditMode.Design, EditMode.Motion]) {
      const next = must(editIn(mode, doc, clipOf(doc), 'rotateY', 30, 50));
      expect(clipOf(next).transform.rotateY).toBe(30);
      expect(clipOf(next).keyframes).toEqual({});
    }
  });

  it('warns in Design, naming the animated props, and only then', () => {
    expect(designWarning(EditMode.Design, clipOf(keyed))).toContain('rotateY');
    expect(designWarning(EditMode.Motion, clipOf(keyed))).toBeNull();
    expect(designWarning(EditMode.Design, clipOf(doc))).toBeNull();
  });

  it('toggles between the two and reads a remembered mode, Design when unknown', () => {
    expect(nextMode(EditMode.Design)).toBe(EditMode.Motion);
    expect(nextMode(EditMode.Motion)).toBe(EditMode.Design);
    expect(readMode('design')).toBe(EditMode.Design);
    expect(readMode('nonsense')).toBe(EditMode.Design);
    expect(readMode(null)).toBe(EditMode.Design);
    expect(readMode('motion')).toBe(EditMode.Motion);
  });
});

describe('remembering the mode', () => {
  const storage = () => {
    const kept = new Map<string, string>();
    return { kept, getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
  };

  it('writes the mode under its key and reads it back', () => {
    const store = storage();

    rememberMode(store, EditMode.Design);

    expect(store.kept.get(EDIT_MODE_KEY)).toBe('design');
    expect(recalledMode(store)).toBe('design');
  });

  it('survives storage that is missing or throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };

    expect(() => rememberMode(broken, EditMode.Design)).not.toThrow();
    expect(recalledMode(broken)).toBeNull();
    expect(recalledMode(null)).toBeNull();
  });
});
