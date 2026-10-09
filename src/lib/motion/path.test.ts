import { describe, expect, it } from 'vitest';
import { Ease } from './design';
import { MotionFormat, findClip, newClip, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { FEEGA_TOKENS } from './brand';
import { defaultProps } from './components';
import { composeHtml } from './hyperframes/compose';
import { transformAt } from './parent';
import { easeCurve, type Keyframe } from './keyframes';
import { bakePaths, pathAt, pathHandles, pathProblem, type MotionPath } from './path';

const SIZE = { width: 1000, height: 1000 };
const lin = (frame: number, value: number, extra: Partial<Keyframe> = {}): Keyframe => ({ frame, value, ease: Ease.Linear, ...extra });

function clipWith(x: Keyframe[], y: Keyframe[], path: Partial<MotionPath> = {}): MotionClip {
  return newClip({ id: 'p', from: 0, durationInFrames: 60, component: 'Shape', props: defaultProps('Shape'), keyframes: { x, y }, path: { autoOrient: false, tangents: [], ...path } });
}

const px = (clip: MotionClip, f: number) => {
  const at = pathAt(clip, f, SIZE)!;
  return [at.x * SIZE.width, at.y * SIZE.height];
};
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('motion path sampling', () => {
  it('a straight two-key path with a linear ease moves at constant speed', () => {
    const clip = clipWith([lin(0, 0), lin(40, 0.4)], [lin(0, 0), lin(40, 0)]);
    expect(px(clip, 20)).toEqual([200, 0]);
  });

  it('a curved segment is sampled by arc length, not by bezier parameter', () => {
    const clip = clipWith([lin(0, 0), lin(30, 0.3)], [lin(0, 0), lin(30, 0)], { tangents: [{ frame: 0, in: [0, 0], out: [0.25, -0.3] }, { frame: 30, in: [-0.02, 0], out: [0, 0] }] });
    const steps = Array.from({ length: 31 }, (_, f) => px(clip, f));
    const gaps = steps.slice(1).map((p, i) => dist(p, steps[i]));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.05 * Math.max(...gaps));
  });

  it('a tangent bends the path off the straight line', () => {
    const clip = clipWith([lin(0, 0), lin(30, 0.3)], [lin(0, 0), lin(30, 0)], { tangents: [{ frame: 0, in: [0, 0], out: [0.1, -0.2] }] });
    expect(px(clip, 15)[1]).toBeLessThan(-10);
  });

  it('without tangents the path is smooth through a middle key', () => {
    const clip = clipWith([lin(0, 0), lin(20, 0.2), lin(40, 0.4)], [lin(0, 0), lin(20, 0.2), lin(40, 0)]);
    const before = px(clip, 19.9);
    const at = px(clip, 20);
    const after = px(clip, 20.1);
    const a1 = Math.atan2(at[1] - before[1], at[0] - before[0]);
    const a2 = Math.atan2(after[1] - at[1], after[0] - at[0]);
    expect(Math.abs(a1 - a2)).toBeLessThan(0.05);
  });

  it('roving middle keys give an even speed along the whole path', () => {
    const clip = clipWith([lin(0, 0), lin(10, 0.1, { roving: true }), lin(40, 0.4)], [lin(0, 0), lin(10, 0.3, { roving: true }), lin(40, 0)]);
    const steps = Array.from({ length: 41 }, (_, f) => px(clip, f));
    const gaps = steps.slice(1).map((p, i) => dist(p, steps[i]));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.08 * Math.max(...gaps));
  });

  it('the ease of the x keyframes times the travel along the path', () => {
    const clip = clipWith([{ frame: 0, value: 0, ease: Ease.Exit }, lin(40, 0.4)], [lin(0, 0), lin(40, 0)]);
    expect(px(clip, 20)[0]).toBeCloseTo(400 * easeCurve(Ease.Exit)(0.5), 1);
  });

  it('auto-orient turns the clip along the direction of travel', () => {
    const right = clipWith([lin(0, 0), lin(40, 0.4)], [lin(0, 0), lin(40, 0)], { autoOrient: true });
    const down = clipWith([lin(0, 0), lin(40, 0)], [lin(0, 0), lin(40, 0.4)], { autoOrient: true });
    expect(pathAt(right, 10, SIZE)!.angle).toBeCloseTo(0, 6);
    expect(pathAt(down, 10, SIZE)!.angle).toBeCloseTo(90, 6);
  });
});

describe('motion path rules', () => {
  it('needs x and y keyed at the same times', () => {
    expect(pathProblem(clipWith([lin(0, 0), lin(40, 0.4)], [lin(0, 0), lin(30, 0)]))).toMatch(/same/);
    expect(pathProblem(clipWith([lin(0, 0), lin(40, 0.4)], [lin(0, 0), lin(40, 0)]))).toBeNull();
  });
});

describe('baking paths for the renderer', () => {
  function docWith(clip: MotionClip): MotionDoc {
    const doc = newMotionDoc(MotionFormat.Square);
    doc.tracks[0].clips.push(clip);
    return doc;
  }

  const curved = clipWith([lin(0, 0), lin(20, 0.2), lin(40, 0.4)], [lin(0, 0), lin(20, -0.3), lin(40, 0)], { autoOrient: true });

  it('replaces x, y and rotateZ with the path sampled every frame', () => {
    const baked = findClip(bakePaths(docWith(curved)), 'p')!.clip;
    const size = { width: 1080, height: 1080 };
    for (const f of [0, 7, 20, 33, 40]) {
      const at = pathAt(curved, f, size)!;
      expect(transformAt(baked, 'x', f)).toBeCloseTo(at.x, 9);
      expect(transformAt(baked, 'y', f)).toBeCloseTo(at.y, 9);
      expect(transformAt(baked, 'rotateZ', f)).toBeCloseTo(at.angle, 9);
    }
    expect(baked.path).toBeNull();
  });

  it('the composition renders the baked path', () => {
    const doc = docWith(curved);
    expect(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} })).toBe(composeHtml({ doc: bakePaths(doc), tokens: FEEGA_TOKENS, assets: {} }));
  });
});

describe('path handles for the canvas', () => {
  it('each key shows its point and its in/out handles, auto ones included', () => {
    const clip = clipWith([lin(0, 0), lin(30, 0.6)], [lin(0, 0), lin(30, 0)], { tangents: [{ frame: 30, in: [-0.1, 0.1], out: [0.1, -0.1] }] });
    const [first, last] = pathHandles(clip, SIZE)!;
    expect(first.point).toEqual([0, 0]);
    expect(first.out[0]).toBeCloseTo(0.1, 9);
    expect(first.out[1]).toBeCloseTo(0, 9);
    expect(last.in).toEqual([-0.1, 0.1]);
  });
});
