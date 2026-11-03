import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { ActionKind, TriggerKind } from '@feega/motion-core/motion/prototype/model';
import { putInteraction } from './ops';
import { DRAG_THRESHOLD_PX, delayed, hotspotsOf, isDrag } from './hotspots';

function docWith(...trigger: ({ kind: TriggerKind; delayMs?: number })[]) {
  let doc = newMotionDoc(MotionFormat.Landscape);
  trigger.forEach((t, i) => {
    const added = addClip(doc, { component: 'Shape', from: 0, durationInFrames: 30 }, `c${i}`);
    if (!added.ok) {
      throw new Error(added.error);
    }
    const put = putInteraction(added.doc, `c${i}`, { id: `i${i}`, trigger: t as never, action: { kind: ActionKind.Navigate, target: 'b' } });
    if (!put.ok) {
      throw new Error(put.error);
    }
    doc = put.doc;
  });
  return doc;
}

const FRAME = { width: 1920, height: 1080 };

describe('hotspotsOf', () => {
  it('places a layer link over the frame as fractions of its size', () => {
    const doc = docWith({ kind: TriggerKind.Click });
    const spots = hotspotsOf(doc, FRAME, () => ({ left: 480, top: 270, width: 960, height: 540 }));

    expect(spots).toEqual([{ clip: 'c0', interaction: expect.objectContaining({ id: 'i0' }), box: { left: 0.25, top: 0.25, width: 0.5, height: 0.5 } }]);
  });

  it('skips layers that are not drawn', () => {
    expect(hotspotsOf(docWith({ kind: TriggerKind.Click }), FRAME, () => null)).toEqual([]);
  });

  it('leaves variant changes to the instance they change', () => {
    const doc = docWith({ kind: TriggerKind.Click });
    const changing = putInteraction(doc, 'c0', { id: 'i0', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.ChangeTo, variant: { State: 'Open' } } });

    expect(changing.ok && hotspotsOf(changing.doc, FRAME, () => ({ left: 0, top: 0, width: 10, height: 10 }))).toEqual([]);
  });

  it('leaves after-delay links to the timer', () => {
    const doc = docWith({ kind: TriggerKind.AfterDelay, delayMs: 500 });

    expect(hotspotsOf(doc, FRAME, () => ({ left: 0, top: 0, width: 10, height: 10 }))).toEqual([]);
  });
});

function parented(doc: MotionDoc, child: string, parent: string): MotionDoc {
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === child ? { ...c, parent } : c)) })) };
}

function trackEach(doc: MotionDoc): MotionDoc {
  const [visual, ...rest] = doc.tracks;
  return { ...doc, tracks: [...visual.clips.map((clip) => ({ ...visual, id: `t-${clip.id}`, clips: [clip] })), ...rest] };
}

const spotOrder = (doc: MotionDoc) => hotspotsOf(doc, FRAME, () => ({ left: 0, top: 0, width: 10, height: 10 })).map((s) => s.clip);

describe('hotspot stacking', () => {
  it('the layer drawn on top takes the click where two links overlap', () => {
    const shared = docWith({ kind: TriggerKind.Click }, { kind: TriggerKind.Click });

    expect(spotOrder(shared)).toEqual(['c0', 'c1']);
    expect(spotOrder(trackEach(shared))).toEqual(['c1', 'c0']);
  });

  it('a child with its own link sits above its parent, wherever its track is', () => {
    const doc = trackEach(docWith({ kind: TriggerKind.Click }, { kind: TriggerKind.Click }));

    expect(spotOrder(parented(doc, 'c0', 'c1'))).toEqual(['c1', 'c0']);
    expect(spotOrder(parented(doc, 'c1', 'c0'))).toEqual(['c0', 'c1']);
  });
});

describe('delayed', () => {
  it('lists the after-delay links of a frame with their delay', () => {
    const doc = docWith({ kind: TriggerKind.Click }, { kind: TriggerKind.AfterDelay, delayMs: 1200 });

    expect(delayed(doc)).toEqual([{ interaction: expect.objectContaining({ id: 'i1' }), delayMs: 1200 }]);
  });
});

describe('isDrag', () => {
  it('needs the pointer to travel past the threshold', () => {
    expect(isDrag(DRAG_THRESHOLD_PX - 1, 0)).toBe(false);
    expect(isDrag(0, DRAG_THRESHOLD_PX)).toBe(true);
    expect(isDrag(-DRAG_THRESHOLD_PX, -1)).toBe(true);
  });
});
