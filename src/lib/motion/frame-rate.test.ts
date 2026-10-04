import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from './doc';
import { FRAME_RATES, maxFrames, setFrameRate } from './frame-rate';
import { addClip, setKeyframes } from './timeline';
import { setCamera, setCameraKeyframes } from './camera-ops';
import { Ease, TransitionKind } from './design';

function edited(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 15, durationInFrames: 90 }, 't1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  const doc = structuredClone(added.doc);
  const clip = doc.tracks[0].clips[0];
  clip.transitionIn = { kind: TransitionKind.Fade, durationInFrames: 9 };
  const keyed = setKeyframes(doc, 't1', 'opacity', [
    { frame: 15, value: 0, ease: Ease.Standard },
    { frame: 45, value: 1, ease: Ease.Standard }
  ]);
  if (!keyed.ok) {
    throw new Error(keyed.error);
  }
  const lit = setCamera(keyed.doc, {});
  if (!lit.ok) {
    throw new Error(lit.error);
  }
  const moved = setCameraKeyframes(lit.doc, 'z', [
    { frame: 0, value: 0, ease: Ease.Standard },
    { frame: 30, value: 200, ease: Ease.Standard }
  ]);
  if (!moved.ok) {
    throw new Error(moved.error);
  }
  return moved.doc;
}

describe('frame rate', () => {
  it('an old doc without a choice stays at 30 fps', () => {
    const { fps, ...old } = newMotionDoc(MotionFormat.Square);
    const parsed = parseMotionDoc(old);

    expect(fps).toBe(30);
    expect(parsed.ok && parsed.doc.fps).toBe(30);
  });

  it.each(FRAME_RATES)('a doc at %i fps is accepted', (fps) => {
    expect(parseMotionDoc({ ...newMotionDoc(MotionFormat.Square), fps }).ok).toBe(true);
  });

  it('a rate outside the list is refused', () => {
    expect(parseMotionDoc({ ...newMotionDoc(MotionFormat.Square), fps: 29 }).ok).toBe(false);
  });

  it('the longest video lasts the same seconds at every rate', () => {
    const at60 = { ...newMotionDoc(MotionFormat.Square), fps: 60, durationInFrames: maxFrames(60) };

    expect(parseMotionDoc(at60).ok).toBe(true);
    expect(parseMotionDoc({ ...at60, durationInFrames: maxFrames(60) + 1 }).ok).toBe(false);
    expect(parseMotionDoc({ ...at60, fps: 30 }).ok).toBe(false);
  });

  it('changing the rate keeps every time in seconds: clips, transitions, keyframes, camera', () => {
    const result = setFrameRate(edited(), 60);
    if (!result.ok) {
      throw new Error(result.error);
    }
    const doc = result.doc;
    const clip = doc.tracks[0].clips[0];

    expect(doc.fps).toBe(60);
    expect(doc.durationInFrames).toBe(15 * 60);
    expect([clip.from, clip.durationInFrames, clip.transitionIn.durationInFrames]).toEqual([30, 180, 18]);
    expect(clip.keyframes.opacity.map((k) => k.frame)).toEqual([30, 90]);
    expect(doc.camera?.keyframes.z?.map((k) => k.frame)).toEqual([0, 60]);
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('a round trip through a faster rate gives the doc back', () => {
    const doc = edited();
    const there = setFrameRate(doc, 60);
    const back = there.ok ? setFrameRate(there.doc, 30) : there;

    expect(back.ok && back.doc).toEqual(doc);
  });

  it('a slower rate rounds to the nearest frame and merges keyframes that land on one', () => {
    const doc = edited();
    doc.tracks[0].clips[0].keyframes.opacity = [
      { frame: 15, value: 0, ease: doc.tracks[0].clips[0].keyframes.opacity[0].ease },
      { frame: 16, value: 0.5, ease: doc.tracks[0].clips[0].keyframes.opacity[0].ease }
    ];
    const result = setFrameRate(doc, 24);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.doc.tracks[0].clips[0].keyframes.opacity.map((k) => [k.frame, k.value])).toEqual([[12, 0], [13, 0.5]]);
    expect(result.doc.tracks[0].clips[0].from).toBe(12);
  });

  it('a new clip lasts its default seconds at any rate', () => {
    const at30 = addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0 }, 'a');
    const at60 = addClip({ ...newMotionDoc(MotionFormat.Square), fps: 60, durationInFrames: 900 }, { component: 'Title', from: 0 }, 'a');
    const frames = (r: typeof at30) => (r.ok ? r.doc.tracks[0].clips[0].durationInFrames : 0);

    expect(frames(at60)).toBe(frames(at30) * 2);
  });

  it('a rate outside the list is refused by the op', () => {
    expect(setFrameRate(edited(), 29 as never).ok).toBe(false);
  });
});
