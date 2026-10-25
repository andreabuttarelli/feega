import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { TrackKind } from '@feega/motion-core/motion/components';
import { addClip, addTrack, type OpResult } from '@feega/motion-core/motion/timeline';
import { flatten, parsePath } from '@feega/motion-core/motion/shape/geometry';
import { polygonArea } from '@feega/motion-core/motion/shape/boolean';
import { buildShapes, regionAt, shapeRegions } from './shape-builder';

const ok = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const SIDE = { width: 0.2, height: 0.2 * (16 / 9) };
const square = (x: number) => ({ component: 'Shape' as const, from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.2 * (16 / 9), fill: x < 0.45 ? '#ff0000' : '#0000ff' } });

function overlapping(): MotionDoc {
  const bottom = ok(addClip(newMotionDoc(MotionFormat.Landscape), square(0.4), 'bottom'));
  const withTop = ok(addTrack(bottom, TrackKind.Visual, 'upper'));
  return ok(addClip(withTop, { ...square(0.5), trackId: 'upper' }, 'top'));
}

const clipsOf = (doc: MotionDoc): MotionClip[] => doc.tracks.flatMap((t) => t.clips) as MotionClip[];

function areaOf(clip: MotionClip): number {
  const outline = parsePath(String(clip.props.path));
  if (typeof outline === 'string') {
    throw new Error(outline);
  }
  const local = outline.reduce((sum, c) => sum + polygonArea(flatten(c)), 0);
  return (local * Number(clip.props.width) * Number(clip.props.height)) / (SIDE.width * SIDE.height);
}

const IDS = ['bottom', 'top'];
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

describe('shape builder regions', () => {
  it('cuts two overlapping shapes into three regions', () => {
    const regions = shapeRegions(overlapping(), IDS, 0);
    expect(regions).toHaveLength(3);
    expect(regions.map((r) => r.members.join('+')).sort()).toEqual(['bottom', 'bottom+top', 'top']);
  });

  it('finds the region under a point', () => {
    const regions = shapeRegions(overlapping(), IDS, 0);
    const doc = overlapping();
    const at = (x: number) => regionAt(regions, [x * doc.width, 0.5 * doc.height]);
    expect(at(0.35)?.members).toEqual(['bottom']);
    expect(at(0.45)?.members.sort()).toEqual(['bottom', 'top']);
    expect(at(0.55)?.members).toEqual(['top']);
    expect(at(0.9)).toBeNull();
  });
});

describe('shape builder result', () => {
  it('click merges picked regions into one shape and keeps the rest as shapes', () => {
    const doc = overlapping();
    const [only, overlap] = ['bottom', 'bottom+top'].map((m) => shapeRegions(doc, IDS, 0).find((r) => r.members.join('+') === m)!);
    const built = ok(buildShapes(doc, IDS, 0, { merge: [only.id, overlap.id], cut: [] }, (i) => `n${i}`));
    const clips = clipsOf(built);
    expect(clips).toHaveLength(2);
    expect(sorted(clips.map(areaOf)).map((a) => Math.round(a * 100) / 100)).toEqual([0.5, 1]);
  });

  it('alt-click removes a region and leaves the other parts', () => {
    const doc = overlapping();
    const regions = shapeRegions(doc, IDS, 0);
    const overlap = regions.find((r) => r.members.length === 2)!;
    const only = regions.find((r) => r.members.join('+') === 'bottom')!;
    const built = ok(buildShapes(doc, IDS, 0, { merge: [only.id], cut: [overlap.id] }, (i) => `n${i}`));
    expect(sorted(clipsOf(built).map(areaOf)).map((a) => Math.round(a * 100) / 100)).toEqual([0.5, 0.5]);
  });

  it('the pieces keep the paint of the shape they came from, and start where the sources started', () => {
    const doc = overlapping();
    const regions = shapeRegions(doc, IDS, 0);
    const topOnly = regions.find((r) => r.members.join('+') === 'top')!;
    const built = ok(buildShapes(doc, IDS, 0, { merge: [topOnly.id], cut: [] }, (i) => `n${i}`));
    const clips = clipsOf(built);
    expect(clips.every((c) => c.from === 0)).toBe(true);
    expect(clips.find((c) => areaOf(c) > 0 && c.props.fill === '#0000ff')).toBeDefined();
  });

  it('does not stretch the video while the pieces are made', () => {
    const doc = { ...overlapping(), durationInFrames: 60 };
    const only = shapeRegions(doc, IDS, 0).find((r) => r.members.join('+') === 'bottom')!;
    const built = ok(buildShapes(doc, IDS, 0, { merge: [only.id], cut: [] }, (i) => `n${i}`));
    expect(built.durationInFrames).toBe(doc.durationInFrames);
  });

  it('refuses when nothing is picked', () => {
    const doc = overlapping();
    expect(buildShapes(doc, IDS, 0, { merge: [], cut: [] }, (i) => `n${i}`).ok).toBe(false);
  });
});
