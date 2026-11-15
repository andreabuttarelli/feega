import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { removeClips, snapTargets } from '@feega/motion-core/motion/timeline';
import { edgeHandles, graphLanes } from '$lib/motion/timeline-view';
import { Place, dropLayers } from './layers';
import { counted } from './counted-list.testkit';
import { subtreeOf } from './core/lifted-drag';

const SIZE = 2000;
const PICKED = 50;

function flatDoc() {
  const base = newMotionDoc(MotionFormat.Landscape);
  const clips = counted(Array.from({ length: SIZE }, (_, i) => newClip({ id: `c${i}`, from: 0, durationInFrames: 30, component: 'Shape', props: {} })));
  return { doc: { ...base, tracks: [{ ...base.tracks[0], clips }] }, clips };
}

describe('lookups index their ids once', () => {
  it('collecting a dragged subtree scans no id list per clip', () => {
    const ids = counted(Array.from({ length: PICKED }, (_, i) => `c${i}`));

    const subtree = subtreeOf(flatDoc().doc, ids);

    expect(subtree.size).toBe(PICKED);
    expect(ids.scans()).toBe(0);
  });

  it('listing snap targets finds no clip by scanning the track', () => {
    const { doc, clips } = flatDoc();
    const exclude = counted(['c0', 'c1']);

    snapTargets(doc, { playhead: 0, exclude });

    expect(clips.scans()).toBe(0);
    expect(exclude.scans()).toBe(0);
  });

  it('removing clips scans neither the ids nor the track per clip', () => {
    const { doc, clips } = flatDoc();
    const ids = counted(Array.from({ length: PICKED }, (_, i) => `c${i}`));

    const result = removeClips(doc, ids);

    expect(result.ok).toBe(true);
    expect(ids.scans()).toBe(0);
    expect(clips.scans()).toBe(0);
  });

  it('choosing graph lanes by selection scans no id list per lane', () => {
    const base = newMotionDoc(MotionFormat.Landscape);
    const clips = Array.from({ length: SIZE }, (_, i) => newClip({ id: `c${i}`, from: 0, durationInFrames: 30, component: 'Shape', props: {}, keyframes: { x: [{ frame: 0, value: 0, ease: 'linear' }] } }));
    const doc = { ...base, tracks: [{ ...base.tracks[0], clips }] };
    const selection = counted(Array.from({ length: PICKED }, (_, i) => `c${i}`));

    const lanes = graphLanes(doc, selection, [], false);

    expect(lanes.length).toBeGreaterThanOrEqual(PICKED);
    expect(selection.scans()).toBe(0);
  });

  it('placing edge handles scans no selection list per clip', () => {
    const spans = Array.from({ length: SIZE }, (_, i) => ({ id: `c${i}`, from: i, durationInFrames: 10 }));
    const selected = counted(Array.from({ length: PICKED }, (_, i) => `c${i}`));

    const handles = edgeHandles(spans, 1, selected);

    expect(handles.length).toBeGreaterThan(SIZE);
    expect(selected.scans()).toBe(0);
  });

  it('dropping layers scans no dragged list per layer in the stack', () => {
    const { doc } = flatDoc();
    const topFirst = Array.from({ length: SIZE }, (_, i) => `c${i}`);
    const dragged = counted(Array.from({ length: PICKED }, (_, i) => `c${i}`));

    dropLayers(doc, dragged, `c${SIZE - 1}`, Place.Above, topFirst);

    expect(dragged.scans()).toBe(0);
  });
});
