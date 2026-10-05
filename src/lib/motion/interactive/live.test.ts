import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setTransform, type OpResult } from '../timeline';
import { precompose, flattenComps } from '../precomp';
import { setExpression } from '../expression/ops';
import { InputKey } from '../expression/inputs';
import { liveScene } from './live';
import { liveSpec } from './spec';
import { bakeExpressions } from '../expression/bake';
import { Outside } from './settings';

const sceneOf = (doc: MotionDoc, outside: Outside) => liveScene(liveSpec({ live: doc, baked: bakeExpressions(doc), outside, parents: [] }));

function ok(result: OpResult): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const FOLLOW_X = 'value + input.pointer.x - 0.5';
const FOLLOW_Y = 'value + input.pointer.y - 0.5';

function follower(doc: MotionDoc, id: string): MotionDoc {
  const placed = ok(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60 }, id));
  return ok(setExpression(ok(setExpression(placed, id, 'x', FOLLOW_X)), id, 'y', FOLLOW_Y));
}

function cell(doc: MotionDoc, inner: string, comp: string, host: string, x: number, y: number): MotionDoc {
  const hosted = ok(precompose(doc, [inner], { comp, clip: host }, comp));
  return ok(setTransform(hosted, host, { scale: 0.5, x, y }));
}

function grid(): MotionDoc {
  let doc = follower(newMotionDoc(MotionFormat.Square), 'dot');
  doc = cell(doc, 'dot', 'motion', 'tl', -0.25, -0.25);
  for (const [id, x, y] of [
    ['tr', 0.25, -0.25],
    ['bl', -0.25, 0.25],
    ['br', 0.25, 0.25]
  ] as const) {
    doc = ok(setTransform(ok(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60 }, id)), id, { scale: 0.5, x, y }));
  }
  return doc;
}

const at = (x: number, y: number) => ({ [InputKey.PointerX]: x, [InputKey.PointerY]: y, [InputKey.Hover]: 1 });

describe('live inputs through nested compositions', () => {
  it('a follower nested in the top-left cell of a 2×2 grid reads the cursor in its own cell', () => {
    const scene = sceneOf(flattenComps(grid()), Outside.Fallback);

    const values = scene.tick(at(0.375, 0.125), 10, 0);

    expect(values.get('tl__0__dot.x')).toBeCloseTo(0.25);
    expect(values.get('tl__0__dot.y')).toBeCloseTo(-0.25);
  });

  it('outside its cell the follower falls back to the default, or holds its last value', () => {
    const fallback = sceneOf(flattenComps(grid()), Outside.Fallback);
    const hold = sceneOf(flattenComps(grid()), Outside.Hold);
    for (const scene of [fallback, hold]) {
      scene.tick(at(0.375, 0.125), 10, 0);
    }

    expect(fallback.tick(at(0.9, 0.9), 11, 0).get('tl__0__dot.x')).toBeCloseTo(0);
    expect(hold.tick(at(0.9, 0.9), 11, 0).get('tl__0__dot.x')).toBeCloseTo(0.25);
  });

  it('holds at any depth: a grid inside a grid maps the cursor through both cells', () => {
    const doc = cell(grid(), 'tl', 'inner-grid', 'outer', 0.25, 0.25);
    const scene = sceneOf(flattenComps(doc), Outside.Fallback);

    const values = scene.tick(at(0.5 + 0.375 * 0.5, 0.5 + 0.125 * 0.5), 10, 0);

    expect(values.get('outer__0__tl__0__dot.x')).toBeCloseTo(0.25);
    expect(values.get('outer__0__tl__0__dot.y')).toBeCloseTo(-0.25);
  });

  it('takes a rotated cell off before reading the cursor', () => {
    let doc = follower(newMotionDoc(MotionFormat.Square), 'dot');
    doc = ok(precompose(doc, ['dot'], { comp: 'motion', clip: 'turned' }, 'motion'));
    doc = ok(setTransform(doc, 'turned', { rotateZ: 90 }));
    const scene = sceneOf(flattenComps(doc), Outside.Fallback);

    const values = scene.tick(at(0.5, 0.75), 0, 0);

    expect(values.get('turned__0__dot.x')).toBeCloseTo(0.25);
    expect(values.get('turned__0__dot.y')).toBeCloseTo(0);
  });

  it('with no input at all every live lane equals the rendered video', () => {
    const scene = sceneOf(flattenComps(grid()), Outside.Fallback);

    expect(scene.tick({}, 10, 0).get('tl__0__dot.x')).toBeCloseTo(0);
  });

  it('tilt and scroll cross every level unchanged', () => {
    let doc = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 60 }, 'card'));
    doc = ok(setExpression(doc, 'card', 'rotateY', 'input.tilt.x * 20 + input.scroll * 10'));
    doc = cell(doc, 'card', 'motion', 'tl', -0.25, -0.25);
    const scene = sceneOf(flattenComps(doc), Outside.Fallback);

    const values = scene.tick({ [InputKey.TiltX]: 0.5, [InputKey.Scroll]: 1, [InputKey.PointerX]: 0.9, [InputKey.PointerY]: 0.9 }, 0, 0);

    expect(values.get('tl__0__card.rotateY')).toBeCloseTo(20);
  });

  it('smooths towards the cursor over real time', () => {
    const placed = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 60 }, 'a'));
    const scene = sceneOf(ok(setExpression(placed, 'a', 'x', 'input.smooth(input.pointer.x, 1)')), Outside.Fallback);

    expect(scene.tick(at(0, 0.5), 0, 0).get('a.x')).toBe(0);
    expect(scene.tick(at(1, 0.5), 0, 1).get('a.x')).toBeCloseTo(1 - Math.exp(-1));
  });

  it('drives a numeric component prop live, and leaves audio-reading expressions baked', () => {
    let doc = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0, durationInFrames: 60 }, 'a'));
    doc = ok(setExpression(doc, 'a', 'tracking', 'input.pointer.x * 0.5'));
    doc = ok(setExpression(doc, 'a', 'opacity', 'input.pointer.x * audio.amp()'));
    const scene = sceneOf(doc, Outside.Fallback);

    expect(scene.lanes.map((l) => l.key)).toEqual(['tracking']);
    expect(scene.tick(at(0.8, 0.5), 0, 0).get('a.tracking')).toBeCloseTo(0.4);
  });

  it('reads a baked lane through layer() at its video value', () => {
    let doc = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 60 }, 'a'));
    doc = ok(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60 }, 'b'));
    doc = ok(setExpression(doc, 'a', 'rotateZ', 'time * 30'));
    doc = ok(setExpression(doc, 'b', 'rotateZ', 'layer("a").rotateZ + input.pointer.x * 10'));
    const scene = sceneOf(doc, Outside.Fallback);

    expect(scene.tick(at(1, 0.5), 30, 0).get('b.rotateZ')).toBeCloseTo(40);
  });
});

