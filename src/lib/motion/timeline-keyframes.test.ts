import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { Interp } from './keyframes';
import { EasePreset } from './graph';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import {
  Direction,
  addClip,
  adjacentKeyframe,
  copyKeyframes,
  deleteKeyframes,
  keyframeFrames,
  moveKeyframes,
  pasteKeyframes,
  removeKeyframes,
  setKeyEase,
  setKeyInterp,
  applyEasePreset,
  copyEase,
  pasteEase,
  setKeyframe,
  setKeyframes,
  setTransform,
  snapTargets,
  type OpResult
} from './timeline';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 30, durationInFrames: 90 }, 't'));
const keyed = must(
  setKeyframes(base, 't', 'rotateY', [
    { frame: 0, value: 0, ease: Ease.Linear },
    { frame: 30, value: 180, ease: Ease.Standard },
    { frame: 60, value: 360, ease: Ease.Linear }
  ])
);
const keys = (doc: MotionDoc, prop: string) => findClip(doc, 't')!.clip.keyframes[prop]?.map((k) => [k.frame, k.value]) ?? [];

describe('transform', () => {
  it('a new clip has no transform overrides and no keyframes', () => {
    const clip = findClip(base, 't')!.clip;

    expect(clip.transform).toEqual({});
    expect(clip.keyframes).toEqual({});
  });

  it('merges a partial transform into the clip', () => {
    const doc = must(setTransform(must(setTransform(base, 't', { rotateX: 20 })), 't', { perspective: 900 }));

    expect(findClip(doc, 't')!.clip.transform).toEqual({ rotateX: 20, perspective: 900 });
  });

  it('refuses a transform value out of range', () => {
    expect(setTransform(base, 't', { opacity: 3 }).ok).toBe(false);
  });
});

describe('keyframe ops', () => {
  it('set_keyframes sorts by frame and refuses props the clip cannot animate', () => {
    const doc = must(setKeyframes(base, 't', 'scale', [{ frame: 10, value: 2, ease: Ease.Linear }, { frame: 0, value: 1, ease: Ease.Linear }]));

    expect(keys(doc, 'scale')).toEqual([
      [0, 1],
      [10, 2]
    ]);
    expect(setKeyframes(base, 't', 'orbit', [{ frame: 0, value: 1, ease: Ease.Linear }]).ok).toBe(false);
  });

  it('an empty list removes the lane', () => {
    expect(findClip(must(setKeyframes(keyed, 't', 'rotateY', [])), 't')!.clip.keyframes).toEqual({});
  });

  it('adds a keyframe at a frame, or updates the one already there keeping its ease', () => {
    const added = must(setKeyframe(keyed, 't', 'rotateY', 45, 200));
    const updated = must(setKeyframe(keyed, 't', 'rotateY', 30, 90));

    expect(keys(added, 'rotateY')).toEqual([
      [0, 0],
      [30, 180],
      [45, 200],
      [60, 360]
    ]);
    expect(findClip(updated, 't')!.clip.keyframes.rotateY[1]).toEqual({ frame: 30, value: 90, ease: Ease.Standard });
  });

  it('removes a lane or only some frames', () => {
    expect(keys(must(removeKeyframes(keyed, 't', 'rotateY', [30])), 'rotateY')).toEqual([
      [0, 0],
      [60, 360]
    ]);
    expect(findClip(must(removeKeyframes(keyed, 't', 'rotateY')), 't')!.clip.keyframes).toEqual({});
  });

  it('moves selected keyframes in time, never before the clip start, overwriting what they land on', () => {
    const moved = must(moveKeyframes(keyed, [{ clipId: 't', prop: 'rotateY', frame: 30 }], 30));
    const clamped = must(moveKeyframes(keyed, [{ clipId: 't', prop: 'rotateY', frame: 30 }], -100));

    expect(keys(moved, 'rotateY')).toEqual([
      [0, 0],
      [60, 180]
    ]);
    expect(keys(clamped, 'rotateY')).toEqual([
      [0, 180],
      [60, 360]
    ]);
  });

  it('moves several keyframes together', () => {
    const moved = must(
      moveKeyframes(
        keyed,
        [
          { clipId: 't', prop: 'rotateY', frame: 0 },
          { clipId: 't', prop: 'rotateY', frame: 30 }
        ],
        5
      )
    );

    expect(keys(moved, 'rotateY')).toEqual([
      [5, 0],
      [35, 180],
      [60, 360]
    ]);
  });

  it('deletes selected keyframes, and the lane with its last one', () => {
    const doc = must(deleteKeyframes(keyed, [0, 30, 60].map((frame) => ({ clipId: 't', prop: 'rotateY', frame }))));

    expect(findClip(doc, 't')!.clip.keyframes).toEqual({});
  });

  it('sets the ease of the segment that leaves a keyframe', () => {
    const doc = must(setKeyEase(keyed, { clipId: 't', prop: 'rotateY', frame: 0 }, [0.1, 0.7, 0.1, 1]));

    expect(findClip(doc, 't')!.clip.keyframes.rotateY[0].ease).toEqual([0.1, 0.7, 0.1, 1]);
  });

  it('copies keyframes relative to the earliest and pastes them at a frame of another clip', () => {
    const other = must(addClip(keyed, { component: 'Text', from: 0, durationInFrames: 90 }, 'x'));
    const board = copyKeyframes(other, [
      { clipId: 't', prop: 'rotateY', frame: 30 },
      { clipId: 't', prop: 'rotateY', frame: 60 }
    ]);
    const pasted = must(pasteKeyframes(other, 'x', board, 10));

    expect(findClip(pasted, 'x')!.clip.keyframes.rotateY.map((k) => [k.frame, k.value])).toEqual([
      [10, 180],
      [40, 360]
    ]);
  });

  it('pasting a prop the target cannot animate fails', () => {
    const model = must(addClip(base, { component: 'Model3D', from: 0 }, 'm'));
    const orbit = must(setKeyframes(model, 'm', 'orbit', [{ frame: 0, value: 0, ease: Ease.Linear }]));
    const board = copyKeyframes(orbit, [{ clipId: 'm', prop: 'orbit', frame: 0 }]);

    expect(pasteKeyframes(orbit, 't', board, 0).ok).toBe(false);
  });
});

describe('keyframe navigation and snapping', () => {
  it('lists keyframe frames on the timeline, in absolute frames', () => {
    expect(keyframeFrames(keyed, ['t'])).toEqual([30, 60, 90]);
  });

  it('jumps to the previous and next keyframe', () => {
    const frames = keyframeFrames(keyed, ['t']);

    expect(adjacentKeyframe(frames, 45, Direction.Forward)).toBe(60);
    expect(adjacentKeyframe(frames, 60, Direction.Back)).toBe(30);
    expect(adjacentKeyframe(frames, 90, Direction.Forward)).toBeNull();
  });

  it('keyframes are snap targets', () => {
    expect(snapTargets(must(setKeyframe(keyed, 't', 'rotateY', 15, 10)), { playhead: 0, exclude: [] })).toContain(45);
  });
});

describe('interpolation of selected keyframes', () => {
  const refs = [
    { clipId: 't', prop: 'rotateY', frame: 30 },
    { clipId: 't', prop: 'rotateY', frame: 60 }
  ];
  const track = (doc: MotionDoc) => findClip(doc, 't')!.clip.keyframes.rotateY;

  it('sets in, out or both on every selected keyframe and leaves the others', () => {
    const held = must(setKeyInterp(keyed, refs, { out: Interp.Hold, in: Interp.Linear }));
    expect(track(held).map((k) => [k.in, k.out])).toEqual([
      [undefined, undefined],
      [Interp.Linear, Interp.Hold],
      [Interp.Linear, Interp.Hold]
    ]);
  });

  it('bezier on both sides goes back to the plain eased keyframe', () => {
    const held = must(setKeyInterp(keyed, refs, { out: Interp.Hold }));
    const back = must(setKeyInterp(held, refs, { in: Interp.Bezier, out: Interp.Bezier }));
    expect(track(back)).toEqual(track(keyed));
  });

  it('roving is refused where it does not apply', () => {
    expect(setKeyInterp(keyed, refs, { roving: true }).ok).toBe(false);
  });

  it('copy and paste keep the interpolation', () => {
    const held = must(setKeyInterp(keyed, refs, { out: Interp.Auto }));
    const pasted = must(pasteKeyframes(held, 't', copyKeyframes(held, refs), 70));
    expect(track(pasted).find((k) => k.frame === 70)?.out).toBe(Interp.Auto);
  });
});

describe('ease presets and the ease clipboard', () => {
  const at = (frame: number) => ({ clipId: 't', prop: 'rotateY', frame });
  const track = (doc: MotionDoc) => findClip(doc, 't')!.clip.keyframes.rotateY;

  it('easy ease on a keyframe flattens both sides of it: its own leaving half and the entering half before it', () => {
    const eased = must(applyEasePreset(keyed, [at(30)], EasePreset.EasyEase));
    const [first, middle] = track(eased);
    expect((first.ease as number[]).slice(2)).toEqual([2 / 3, 1]);
    expect((middle.ease as number[]).slice(0, 2)).toEqual([1 / 3, 0]);
  });

  it('an Apple curve replaces the segment leaving the keyframe and turns it back to bezier', () => {
    const held = must(setKeyInterp(keyed, [at(0)], { out: Interp.Hold }));
    const eased = must(applyEasePreset(held, [at(0)], EasePreset.AppleEaseInOut));
    expect(track(eased)[0]).toEqual({ frame: 0, value: 0, ease: [0.42, 0, 0.58, 1] });
  });

  it('a copied ease pastes onto every selected keyframe with its interpolation', () => {
    const source = must(setKeyInterp(must(applyEasePreset(keyed, [at(0)], EasePreset.AppleEaseOut)), [at(0)], { in: Interp.Linear }));
    const board = copyEase(source, at(0))!;
    const pasted = must(pasteEase(source, [at(30), at(60)], board));
    expect(track(pasted)[1]).toMatchObject({ ease: [0, 0, 0.58, 1], in: Interp.Linear });
    expect(track(pasted)[2]).toMatchObject({ ease: [0, 0, 0.58, 1], in: Interp.Linear });
  });
});
