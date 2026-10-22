import { describe, expect, it } from 'vitest';
import { fillSchema, FillType, type Fill } from '$lib/motion/fill/model';
import { addClip } from '$lib/motion/timeline';
import { findClip, MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { GradientGrip, draggedFill, gradientHandles, gradientTarget, withFill } from './gradient-handles';

const box = { width: 200, height: 100 };
const linear = (angle: number): Fill => fillSchema.parse({ type: FillType.Linear, angle, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] });

describe('on-canvas gradient handles', () => {
  it('a 0° linear runs left to right across the box', () => {
    const h = gradientHandles(linear(0), box)!;
    expect(h.start[0]).toBeCloseTo(0);
    expect(h.end[0]).toBeCloseTo(200);
    expect(h.end[1]).toBeCloseTo(50);
    expect(h.stops.map((s) => Math.round(s[0]))).toEqual([0, 200]);
  });

  it('dragging the end below the centre turns it to 90°', () => {
    const f = draggedFill(linear(0), box, { grip: GradientGrip.End }, [100, 120]);
    expect(f.type === FillType.Linear && f.angle).toBeCloseTo(90);
  });

  it('dragging a stop moves its position along the line', () => {
    const f = draggedFill(linear(0), box, { grip: GradientGrip.Stop, stop: 1 }, [150, 10]);
    expect(f.type === FillType.Linear && f.stops[1].pos).toBeCloseTo(0.75);
  });

  it('radial: the centre moves, the edge sets the radius', () => {
    const radial = fillSchema.parse({ type: FillType.Radial, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] });
    const moved = draggedFill(radial, box, { grip: GradientGrip.Start }, [50, 25]);
    expect(moved.type === FillType.Radial && moved.center).toEqual({ x: 0.25, y: 0.25 });
    const wider = draggedFill(radial, box, { grip: GradientGrip.End }, [300, 50]);
    expect(wider.type === FillType.Radial && wider.radius).toBeCloseTo(2);
  });

  it('a solid fill has no handles', () => {
    expect(gradientHandles(fillSchema.parse({ type: FillType.Solid, color: '#000000' }), box)).toBeNull();
  });
});

describe('the gradient a selected element shows handles for', () => {
  it('is its top visible gradient fill, and a drag writes it back in place', () => {
    const fills = [fillSchema.parse({ type: FillType.Solid, color: '#000000' }), linear(0)];
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', fills } }, 's');
    if (!added.ok) {
      throw new Error(added.error);
    }
    const target = gradientTarget(added.doc, 's')!;
    expect(target.index).toBe(1);
    const written = withFill(added.doc, 's', target.index, linear(45));
    const stored = written.ok ? (findClip(written.doc, 's')!.clip.props.fills as Fill[]) : [];
    expect(stored[1].type === FillType.Linear && stored[1].angle).toBe(45);
    expect(stored[0].type).toBe(FillType.Solid);
  });
});
