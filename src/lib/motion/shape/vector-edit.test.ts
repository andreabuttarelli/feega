import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import type { Outline, Pt } from '@feega/motion-core/motion/shape/geometry';
import { pathSpace } from '@feega/motion-core/motion/shape/space';
import { setParent } from '$lib/motion/parent-ops';
import { canEditPoints, commitOutline, editsPoints, enterPointEdit, pointDraft, landsOn, pointBounds, snapPoint, snapReach, snapTargets } from './vector-edit';

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
  it('every shape kind enters it, other layers do not', () => {
    const can = (shape: string) => canEditPoints(findClip(withShape(shape), 's')!.clip);

    expect(['path', 'vector', 'polygon', 'star', 'line', 'rect', 'circle', 'ellipse'].map(can)).toEqual([true, true, true, true, true, true, true, true]);
    expect(canEditPoints({ component: 'Text', props: {} })).toBe(false);
  });

  it('a shape holding children is a container: its points are not edited', () => {
    const doc = must(setParent(must(addClip(withShape('rect'), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'Hi' } }, 't')), 't', 's'));

    expect(editsPoints(doc, findClip(doc, 's')!.clip)).toBe(false);
    expect(editsPoints(withShape('rect'), findClip(withShape('rect'), 's')!.clip)).toBe(true);
  });

  it('a rectangle and an ellipse become paths with their own corners on entering', () => {
    const rect = withShape('rect');
    const ellipse = withShape('ellipse');
    const rectPath = String(findClip(must(enterPointEdit(rect, findClip(rect, 's')!.clip)), 's')!.clip.props.path);
    const ellipsePath = findClip(must(enterPointEdit(ellipse, findClip(ellipse, 's')!.clip)), 's')!.clip.props;

    expect(rectPath.match(/[ML]/g)).toHaveLength(4);
    expect(ellipsePath.shape).toBe('path');
    expect(String(ellipsePath.path)).toContain('C');
  });

  it('a double-click enters only when it lands on the shape', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'r'));
    const side = doc.width;

    expect(landsOn(doc, 'r', 0, [side * 0.5, side * 0.5])).toBe(true);
    expect(landsOn(doc, 'r', 0, [side * 0.1, side * 0.1])).toBe(false);
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

describe('a rectangle in point edit', () => {
  const rect = withShape('rect');

  it('is edited as a path draft while the doc keeps the rectangle', () => {
    const draft = pointDraft(rect, 's');

    expect(findClip(draft, 's')!.clip.props.shape).toBe('path');
    expect(findClip(rect, 's')!.clip.props.shape).toBe('rect');
  });

  it('shows the doc itself when nothing is in point edit', () => {
    expect(pointDraft(rect, null)).toBe(rect);
  });
});

describe('editing a point refits the box', () => {
  const square = () => must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'path', path: 'M0 0 L1 0 L1 1 L0 1 Z', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'p'));
  const dragged: Outline = [{ closed: true, vertices: ([[0, 0], [1, 0], [1, 2], [0, 1]] as Pt[]).map((p) => ({ p, in: p, out: p })) }];

  it('a point dragged below the box grows the height and keeps the shape where it was', () => {
    const doc = must(commitOutline(square(), 'p', dragged, 0));
    const props = findClip(doc, 'p')!.clip.props;

    expect(Number(props.height)).toBeCloseTo(0.4, 5);
    expect(Number(props.width)).toBeCloseTo(0.2, 5);
    expect(Number(props.y)).toBeCloseTo(0.6, 5);
    expect(pathSpace(doc, 'p', 0).toFrame([0, 0])).toEqual(pathSpace(square(), 'p', 0).toFrame([0, 0]).map((n) => expect.closeTo(n, 5)));
  });

  it('a morphing path keeps its box, so the morph targets stay aligned', () => {
    const morphing = must(setProps(square(), 'p', { morphs: ['M0 0 L1 1 Z'] }));
    const props = findClip(must(commitOutline(morphing, 'p', dragged, 0)), 'p')!.clip.props;

    expect(Number(props.height)).toBeCloseTo(0.2, 5);
  });
});
