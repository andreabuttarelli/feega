import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from './doc';
import { addClip, setKeyframes, setTransform } from './timeline';
import { Ease } from './design';
import { DocMode, docMode, setStill } from './still';
import { frameOf, guessedBoxes, liftElement, linkOutput, mediaElement, placeElement, OutputKind } from './move-element';

const IMAGE_ID = '11111111-2222-4333-8444-555555555555';
const VIDEO_ID = '99999999-2222-4333-8444-555555555555';
const ids = () => {
  let n = 0;
  return () => `n${++n}`;
};

function must<T>(result: { ok: true; doc: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function source(): MotionDoc {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 30, durationInFrames: 60, props: { text: 'hello', x: 0.25, y: 0.5, width: 0.4, size: 0.05 } }, 'txt'));
  doc = must(setKeyframes(doc, 'txt', 'opacity', [
    { frame: 0, value: 0, ease: Ease.Standard },
    { frame: 30, value: 1, ease: Ease.Standard }
  ]));
  doc = must(setKeyframes(doc, 'txt', 'x', [
    { frame: 0, value: 0.25, ease: Ease.Standard },
    { frame: 30, value: 0.35, ease: Ease.Standard }
  ]));
  doc = must(addClip(doc, { component: 'Image', from: 0, durationInFrames: 90, props: { assetId: IMAGE_ID } }, 'img'));
  return { ...doc, assets: [{ id: IMAGE_ID, kind: 'image', name: 'photo' }] };
}

const target = (format = MotionFormat.Vertical, fps = 60): MotionDoc => ({ ...newMotionDoc(format), fps: fps as MotionDoc['fps'], durationInFrames: 10 * fps });

describe('lifting an element out of a frame', () => {
  it('removes the clip from the source and carries what it needs', () => {
    const lifted = liftElement(source(), 'img');
    if (!lifted.ok) throw new Error(lifted.error);

    expect(findClip(lifted.doc, 'img')).toBeNull();
    expect(lifted.element.clip.id).toBe('img');
    expect(lifted.element.carried.assets).toEqual([{ id: IMAGE_ID, kind: 'image', name: 'photo' }]);
    expect(lifted.element.size).toEqual({ width: 1920, height: 1080 });
  });

  it('an unknown element is refused', () => {
    expect(liftElement(source(), 'nope')).toEqual({ ok: false, error: 'no element nope in this frame' });
  });
});

describe('placing an element in another frame', () => {
  it('keeps props and keyframes, re-timed to the target fps', () => {
    const lifted = liftElement(source(), 'txt');
    if (!lifted.ok) throw new Error(lifted.error);

    const placed = must(placeElement(target(), lifted.element, { at: { x: 0.25, y: 0.5 } }, ids()));
    const clip = findClip(placed, 'txt')!.clip;

    expect(clip.props.text).toBe('hello');
    expect(clip.from).toBe(60);
    expect(clip.durationInFrames).toBe(120);
    expect(clip.keyframes.opacity.map((k) => k.frame)).toEqual([0, 60]);
    expect(parseMotionDoc(placed).ok).toBe(true);
  });

  it('puts a laid-out element centre at the drop point and shifts its position keys with it', () => {
    const lifted = liftElement(source(), 'txt');
    if (!lifted.ok) throw new Error(lifted.error);

    const placed = must(placeElement(target(), lifted.element, { at: { x: 0.75, y: 0.2 } }, ids()));
    const clip = findClip(placed, 'txt')!.clip;

    expect(clip.props.x).toBeCloseTo(0.75);
    expect(clip.props.y).toBeCloseTo(0.2);
    expect(clip.keyframes.x.map((k) => k.value)).toEqual([0.75, expect.closeTo(0.85)]);
  });

  it('keeps the element pixel size in a frame of another shape', () => {
    const lifted = liftElement(source(), 'txt');
    if (!lifted.ok) throw new Error(lifted.error);

    const placed = must(placeElement(target(MotionFormat.Vertical), lifted.element, { at: { x: 0.5, y: 0.5 } }, ids()));
    const clip = findClip(placed, 'txt')!.clip;

    expect(clip.props.width).toBeCloseTo((0.4 * 1920) / 1080);
    expect(clip.props.size).toBeCloseTo(0.05);
  });

  it('an element with no layout box moves by its transform offset', () => {
    let doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Particles', from: 0, durationInFrames: 30 }, 'fx'));
    doc = must(setTransform(doc, 'fx', { x: 0.1 }));
    const lifted = liftElement(doc, 'fx');
    if (!lifted.ok) throw new Error(lifted.error);

    const placed = must(placeElement(target(MotionFormat.Square, 30), lifted.element, { at: { x: 0.8, y: 0.5 } }, ids()));

    expect(findClip(placed, 'fx')!.clip.transform.x).toBeCloseTo(0.3);
  });

  it('registers the carried assets in the target once', () => {
    const lifted = liftElement(source(), 'img');
    if (!lifted.ok) throw new Error(lifted.error);
    const already = { ...target(), assets: [{ id: IMAGE_ID, kind: 'image' as const, name: 'photo' }] };

    expect(must(placeElement(target(), lifted.element, { at: { x: 0.5, y: 0.5 } }, ids())).assets).toEqual([{ id: IMAGE_ID, kind: 'image', name: 'photo' }]);
    expect(must(placeElement(already, lifted.element, { at: { x: 0.5, y: 0.5 } }, ids())).assets).toHaveLength(1);
  });

  it('a clip id already used in the target gets a fresh one', () => {
    const lifted = liftElement(source(), 'txt');
    if (!lifted.ok) throw new Error(lifted.error);
    const taken = must(addClip(target(), { component: 'Title', from: 0 }, 'txt'));

    const placed = must(placeElement(taken, lifted.element, { at: { x: 0.5, y: 0.5 } }, ids()));

    expect(placed.tracks.flatMap((t) => t.clips).map((c) => c.id).sort()).toEqual(['n1', 'txt']);
  });

  it('lands on a new top track', () => {
    const lifted = liftElement(source(), 'img');
    if (!lifted.ok) throw new Error(lifted.error);

    const placed = must(placeElement(target(), lifted.element, { at: { x: 0.5, y: 0.5 } }, ids()));

    expect(placed.tracks[0].clips.map((c) => c.id)).toEqual(['img']);
  });

  it('in a still the element covers the still frame', () => {
    const lifted = liftElement(source(), 'txt');
    if (!lifted.ok) throw new Error(lifted.error);
    const still = must(setStill(target(MotionFormat.Square, 30), 5));

    const clip = findClip(must(placeElement(still, lifted.element, { at: { x: 0.5, y: 0.5 } }, ids())), 'txt')!.clip;

    expect(clip.from).toBeLessThanOrEqual(150);
    expect(clip.from + clip.durationInFrames).toBeGreaterThan(150);
  });

  it('at the playhead in a video frame, growing the frame to fit', () => {
    const element = mediaElement({ kind: OutputKind.Video, assetId: VIDEO_ID, name: 'clip', seconds: 4 });
    const short = { ...target(MotionFormat.Landscape, 30), durationInFrames: 60 };

    const placed = must(placeElement(short, element, { at: { x: 0.5, y: 0.5 }, frame: 30 }, ids()));
    const clip = placed.tracks[0].clips[0];

    expect(clip).toMatchObject({ component: 'Video', from: 30, durationInFrames: 120, props: { assetId: VIDEO_ID } });
    expect(placed.durationInFrames).toBe(150);
    expect(placed.assets).toEqual([{ id: VIDEO_ID, kind: 'video', name: 'clip' }]);
  });
});

describe('a new frame made of one element', () => {
  it('is fitted to the element box, same kind as its source', () => {
    const lifted = liftElement(source(), 'txt');
    if (!lifted.ok) throw new Error(lifted.error);

    const doc = frameOf(lifted.element, DocMode.Video, { left: 0.05, top: 0.4, width: 0.4, height: 0.2 }, ids());
    const clip = findClip(doc, 'txt')!.clip;

    expect({ width: doc.width, height: doc.height }).toEqual({ width: 768, height: 216 });
    expect(docMode(doc)).toBe(DocMode.Video);
    expect(clip.from).toBe(0);
    expect(clip.props).toMatchObject({ x: 0.5, y: 0.5, width: 1 });
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('a still element makes a still frame', () => {
    const lifted = liftElement(must(setStill(source(), 1.5)), 'txt');
    if (!lifted.ok) throw new Error(lifted.error);

    const doc = frameOf(lifted.element, DocMode.Still, { left: 0, top: 0, width: 0.5, height: 0.5 }, ids());

    expect(docMode(doc)).toBe(DocMode.Still);
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('a generated picture makes a frame its own size, within the limits', () => {
    const element = mediaElement({ kind: OutputKind.Image, assetId: IMAGE_ID, name: 'gen', width: 3000, height: 2000 });

    const doc = frameOf(element, DocMode.Still, null, ids());

    expect({ width: doc.width, height: doc.height }).toEqual({ width: 1620, height: 1080 });
    expect(doc.tracks[0].clips[0].props).toMatchObject({ assetId: IMAGE_ID, width: 1, height: 1 });
  });
});

describe('an output linked to a frame', () => {
  it('lands once, and a new output updates the same element', () => {
    const first = must(linkOutput(target(), 'gen-node', mediaElement({ kind: OutputKind.Image, assetId: IMAGE_ID, name: 'a' }), ids()));
    const again = must(linkOutput(first, 'gen-node', mediaElement({ kind: OutputKind.Image, assetId: VIDEO_ID, name: 'b' }), ids()));

    const clips = again.tracks.flatMap((t) => t.clips);
    expect(clips).toHaveLength(1);
    expect(clips[0].props.assetId).toBe(VIDEO_ID);
    expect(again.links).toEqual({ 'gen-node': clips[0].id });
  });

  it('a text output becomes a text element and follows the new text', () => {
    const first = must(linkOutput(target(), 'txt-node', mediaElement({ kind: OutputKind.Text, text: 'one', name: 'copy' }), ids()));
    const again = must(linkOutput(first, 'txt-node', mediaElement({ kind: OutputKind.Text, text: 'two', name: 'copy' }), ids()));

    expect(again.tracks.flatMap((t) => t.clips).map((c) => [c.component, c.props.text])).toEqual([['Text', 'two']]);
  });

  it('an element the user deleted comes back when the output changes', () => {
    const first = must(linkOutput(target(), 'gen-node', mediaElement({ kind: OutputKind.Image, assetId: IMAGE_ID, name: 'a' }), ids()));
    const emptied = { ...first, tracks: first.tracks.map((t) => ({ ...t, clips: [] })) };

    expect(must(linkOutput(emptied, 'gen-node', mediaElement({ kind: OutputKind.Image, assetId: IMAGE_ID, name: 'a' }), ids())).tracks.flatMap((t) => t.clips)).toHaveLength(1);
  });
});

describe('the boxes the stage draws before the player measures', () => {
  it('a laid-out clip gets its box from its own props, in frame pixels', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'hi', x: 0.5, y: 0.5, width: 0.8, height: 0.4 } }, 'box'));

    const box = guessedBoxes(doc).box;
    expect(box.left).toBeCloseTo(0.1 * doc.width);
    expect(box.top).toBeCloseTo(0.3 * doc.height);
    expect(box.width).toBeCloseTo(0.8 * doc.width);
    expect(box.height).toBeCloseTo(0.4 * doc.height);
  });
});
