import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { canEditPoints, enterPointEdit, pointBounds, snapPoint, snapReach, snapTargets } from './vector-edit';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const FRAME = { width: 1000, height: 500 };
const REACH = 8;

const withShape = (shape: string) => must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape } }, 's'));

describe('vector edit mode', () => {
  it('only paths, vectors, polygons, stars and lines enter it', () => {
    const can = (shape: string) => canEditPoints(findClip(withShape(shape), 's')!.clip);

    expect([can('path'), can('vector'), can('polygon'), can('star'), can('line')]).toEqual([true, true, true, true, true]);
    expect([can('rect'), can('ellipse')]).toEqual([false, false]);
    expect(canEditPoints({ component: 'Text', props: {} })).toBe(false);
  });

  it('a polygon becomes a path on entering, a path stays as it is', () => {
    const polygon = withShape('polygon');
    const entered = must(enterPointEdit(polygon, findClip(polygon, 's')!.clip));
    const path = withShape('path');

    expect(findClip(entered, 's')!.clip.props.shape).toBe('path');
    expect(must(enterPointEdit(path, findClip(path, 's')!.clip))).toBe(path);
  });

  it('a point near the frame edge or centre snaps to it, and guides say where', () => {
    const edge = snapPoint([996, 100], [], FRAME, REACH);
    const centre = snapPoint([503, 130], [], FRAME, REACH);

    expect(edge.point[0]).toBe(1000);
    expect(edge.guides).toContainEqual({ axis: 'x', at: 1000 });
    expect(centre.point).toEqual([500, 130]);
  });

  it('a point snaps to a sibling or to another point of its own path', () => {
    const sibling = { left: 100, right: 300, top: 50, bottom: 150 };
    const snapped = snapPoint([196, 52], [sibling, pointBounds([400, 400])], FRAME, REACH);

    expect(snapped.point).toEqual([200, 50]);
    expect(snapPoint([397, 300], [pointBounds([400, 401])], FRAME, REACH).point[0]).toBe(400);
  });

  it('far from everything it does not move', () => {
    expect(snapPoint([333, 111], [], FRAME, REACH)).toEqual({ point: [333, 111], guides: [] });
  });

  it('the other layers on screen are the snap targets, not the shape being edited', () => {
    const two = must(addClip(withShape('path'), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.5, height: 0.5 } }, 'other'));
    const [target] = snapTargets(two, 's', 0);

    expect(snapTargets(two, 's', 0)).toHaveLength(1);
    expect(target.right - target.left).toBeCloseTo(two.width * 0.5, 3);
    expect(snapTargets(two, 's', 99)).toHaveLength(0);
  });

  it('the reach is a fixed number of screen pixels, whatever the zoom', () => {
    expect(snapReach(1000, 500)).toBe(2 * snapReach(1000, 1000));
  });
});
