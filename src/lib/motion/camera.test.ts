import { describe, expect, it } from 'vitest';
import { CAMERA, MAX_DOF_LAYERS, Space, cameraMath, newCamera, stageSpec, type StageSpec } from './camera';
import { DOC_VERSION, MotionFormat, newMotionDoc, parseMotionDoc, upgradeDoc, type MotionDoc } from './doc';
import { sampleTrack, type Keyframe } from './keyframes';
import { Ease } from './design';
import { addClip, type OpResult } from './timeline';

const math = cameraMath(sampleTrack);

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

type Vec = [number, number, number];

function apply(m: number[], p: Vec): Vec {
  const [x, y, z] = p;
  return [0, 1, 2].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]) as Vec;
}

function onScreen(spec: StageSpec, frame: number, p: Vec): [number, number] {
  const state = math.frameAt(spec, frame);
  const [x, y, z] = apply(state.world, p);
  const k = state.perspective / (state.perspective - z);
  return [x * k, y * k];
}

const close = (a: number[], b: number[], digits = 3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));

function spec(camera = newCamera(), layers: StageSpec['layers'] = []): StageSpec {
  return { ...stageSpec({ width: 1920, height: 1080, camera }), layers };
}

describe('the camera in the doc', () => {
  it('a version 3 doc gains no camera, and every clip a world depth of 0', () => {
    const v3 = { ...newMotionDoc(MotionFormat.Landscape), version: 3, tracks: [{ id: 'v1', kind: 'visual', name: '', clips: [{ id: 'a', from: 0, durationInFrames: 30, component: 'Title', props: {} }] }] } as Record<string, unknown>;
    delete v3.camera;

    const up = upgradeDoc(v3) as MotionDoc;
    const parsed = parseMotionDoc(v3);

    expect(DOC_VERSION).toBe(4);
    expect(up.camera).toBeNull();
    expect(up.tracks[0].clips[0]).toMatchObject({ depth: 0, space: Space.World });
    expect(parsed.ok).toBe(true);
  });

  it('refuses a camera keyframe outside the range of its value', () => {
    const doc = { ...newMotionDoc(MotionFormat.Landscape), camera: { ...newCamera(), keyframes: { fov: [{ frame: 0, value: 400, ease: Ease.Linear }] } } };

    expect(parseMotionDoc(doc)).toMatchObject({ ok: false });
  });

  it('a new clip sits at depth 0 in the world', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0 }, 't'));

    expect(doc.tracks[0].clips[0]).toMatchObject({ depth: 0, space: Space.World });
  });
});

describe('the camera as the inverse transform of the world', () => {
  it('at rest the world is not moved and the perspective comes from the field of view', () => {
    const s = spec();
    const state = math.frameAt(s, 0);

    expect(state.perspective).toBeCloseTo(540 / Math.tan(((CAMERA.fov.fallback / 2) * Math.PI) / 180), 6);
    close(state.world, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });

  it('a layer in depth looks the same size at rest, and moves less than the front layer when the camera trucks', () => {
    const far = 2000;
    const scale = (s: StageSpec) => (s.rest + far) / s.rest;
    const still = spec();
    const [edgeX] = onScreen(still, 0, [960 * scale(still), 0, -far]);
    expect(edgeX).toBeCloseTo(960, 3);

    const trucked = spec({ ...newCamera(), base: { x: 0.1 } });
    const [front] = onScreen(trucked, 0, [0, 0, 0]);
    const [back] = onScreen(trucked, 0, [0, 0, -far]);

    expect(front).toBeCloseTo(-192, 3);
    expect(Math.abs(back)).toBeLessThan(Math.abs(front) / 2);
  });

  it('dollying in grows the front layer more than the back one', () => {
    const s = spec({ ...newCamera(), base: { z: 500 } });
    const [front] = onScreen(s, 0, [100, 0, 0]);
    const [back] = onScreen(s, 0, [100, 0, -2000]);

    expect(front).toBeGreaterThan(100);
    expect(front / 100).toBeGreaterThan(back / 100);
  });

  it('a zoom changes the size without moving the camera', () => {
    const s = spec({ ...newCamera(), base: { fov: 25 } });
    const [x] = onScreen(s, 0, [100, 0, 0]);

    expect(x).toBeCloseTo((100 * math.perspectiveOf(25, 1080)) / s.rest, 3);
  });

  it('samples camera keyframes with their eases, frame by frame', () => {
    const z: Keyframe[] = [{ frame: 0, value: 0, ease: [0.4, 0, 0.2, 1] }, { frame: 30, value: 300, ease: Ease.Linear }];
    const camera = { ...newCamera(), keyframes: { z } };
    const s = spec(camera);

    expect(math.valuesAt(s, 15).z).toBeCloseTo(sampleTrack(z, 15), 9);
    expect(math.valuesAt(s, 60).z).toBe(300);
  });

  it('the same frame gives the same state whatever was asked before (seek determinism)', () => {
    const s = spec({ ...newCamera(), dof: true, keyframes: { rotateY: [{ frame: 0, value: -20, ease: Ease.Standard }, { frame: 90, value: 20, ease: Ease.Linear }], focusDistance: [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 90, value: 1500, ease: Ease.Linear }] } }, [{ id: 'a', depth: 1500, kind: 'flat', dof: true }]);
    const order = [60, 10, 89, 0, 60, 30, 10, 89];
    const seen = new Map<number, string>();
    for (const f of order) {
      const out = JSON.stringify(math.frameAt(s, f));
      expect(seen.get(f) ?? out).toBe(out);
      seen.set(f, out);
    }
  });
});

describe('depth of field', () => {
  it('blur grows with the distance from the focus plane, times the aperture', () => {
    expect(math.dofBlur(4, 500, 0)).toBe(20);
    expect(math.dofBlur(4, 0, 500)).toBe(20);
    expect(math.dofBlur(2, 500, 0)).toBe(10);
  });

  it('is skipped below half a pixel and capped', () => {
    expect(math.dofBlur(4, 10, 0)).toBe(0);
    expect(math.dofBlur(20, 20000, 0)).toBe(math.MAX_BLUR);
  });

  it('only a layer that takes part and a camera with depth of field on blur', () => {
    const layers: StageSpec['layers'] = [
      { id: 'near', depth: 0, kind: 'flat', dof: true },
      { id: 'far', depth: 1000, kind: 'flat', dof: true },
      { id: 'capped', depth: 1000, kind: 'flat', dof: false }
    ];
    const on = math.frameAt(spec({ ...newCamera(), dof: true, base: { aperture: 2 } }, layers), 0);
    const off = math.frameAt(spec({ ...newCamera(), dof: false, base: { aperture: 2 } }, layers), 0);

    expect(on.layers.map((l) => l.blur)).toEqual([0, 20, 0]);
    expect(off.layers.every((l) => l.blur === 0)).toBe(true);
  });

  it(`at most ${MAX_DOF_LAYERS} layers take part, background first`, () => {
    let doc = newMotionDoc(MotionFormat.Landscape);
    for (let i = 0; i < MAX_DOF_LAYERS + 3; i++) {
      doc = must(addClip(doc, { component: 'Shape', from: 0 }, `s${i}`));
    }
    const s = stageSpec({ ...doc, camera: { ...newCamera(), dof: true } });

    expect(s.layers.filter((l) => l.dof)).toHaveLength(MAX_DOF_LAYERS);
    expect(s.layers[0]).toMatchObject({ id: 's0', dof: true });
  });

  it('a screen-space clip is not on the stage, a 3D clip faces the camera', () => {
    let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Caption', from: 0 }, 'cap'));
    doc = must(addClip(doc, { component: 'Shape3D', from: 0 }, 'cube'));
    doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'cap' ? { ...c, space: Space.Screen } : c)) })) };
    const s = stageSpec({ ...doc, camera: newCamera() });

    expect(s.layers.map((l) => [l.id, l.kind])).toEqual([['cube', 'billboard']]);
  });
});
