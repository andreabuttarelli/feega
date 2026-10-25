import { describe, expect, it } from 'vitest';
import { CAMERA_LANE, Space, cameraMath, stageSpec, type StageSpec } from './camera';
import { CameraPreset, applyPreset, cameraEditAt, cameraKeyToggle, cameraLanes, cameraValueAt, focusOn, removeCamera, setCamera, setCameraKeyframe, setCameraKeyframes, setClipDepth } from './camera-ops';
import { Ease } from './design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { sampleTrack } from './keyframes';
import { addClip, deleteKeyframes, moveKeyframes, setKeyEase, type OpResult } from './timeline';

const math = cameraMath(sampleTrack);

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function screenOf(spec: StageSpec, frame: number, p: [number, number, number]): [number, number] {
  const state = math.frameAt(spec, frame);
  const m = state.world;
  const [x, y, z] = [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
  const k = state.perspective / (state.perspective - z);
  return [x * k, y * k];
}

const layered = () => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 300 }, 'title'));
  doc = must(addClip(doc, { component: 'Image', from: 0, durationInFrames: 300 }, 'product'));
  doc = must(setClipDepth(doc, 'product', { depth: 1200 }));
  return doc;
};

describe('camera edits', () => {
  it('set_camera creates the camera with the values given, and validates them', () => {
    const doc = must(setCamera(newMotionDoc(MotionFormat.Landscape), { base: { fov: 35 }, dof: true }));

    expect(doc.camera).toEqual({ base: { fov: 35 }, dof: true, keyframes: {}, expressions: {} });
    expect(setCamera(doc, { base: { fov: 400 } }).ok).toBe(false);
    expect(must(removeCamera(doc)).camera).toBeNull();
  });

  it('camera keyframes are in video frames, sorted, and an empty lane goes away', () => {
    let doc = must(setCameraKeyframes(newMotionDoc(MotionFormat.Landscape), 'z', [{ frame: 60, value: 500, ease: Ease.Linear }, { frame: 0, value: 0, ease: Ease.Standard }]));
    expect(doc.camera!.keyframes.z!.map((k) => k.frame)).toEqual([0, 60]);

    doc = must(setCameraKeyframe(doc, 'z', 30, 100));
    expect(doc.camera!.keyframes.z!.map((k) => k.value)).toEqual([0, 100, 500]);

    expect(setCameraKeyframes(doc, 'fov', [{ frame: 0, value: 1, ease: Ease.Linear }]).ok).toBe(false);
    expect(must(setCameraKeyframes(doc, 'z', [])).camera!.keyframes).toEqual({});
  });

  it('the timeline moves, re-eases and deletes camera keyframes like clip ones', () => {
    let doc = must(setCameraKeyframes(newMotionDoc(MotionFormat.Landscape), 'rotateY', [{ frame: 0, value: 0, ease: Ease.Standard }, { frame: 30, value: 20, ease: Ease.Linear }]));
    doc = must(moveKeyframes(doc, [{ clipId: CAMERA_LANE, prop: 'rotateY', frame: 30 }], 15));
    doc = must(setKeyEase(doc, { clipId: CAMERA_LANE, prop: 'rotateY', frame: 0 }, [0.2, 0, 0.2, 1]));

    expect(doc.camera!.keyframes.rotateY).toEqual([{ frame: 0, value: 0, ease: [0.2, 0, 0.2, 1] }, { frame: 45, value: 20, ease: Ease.Linear }]);
    expect(must(deleteKeyframes(doc, [{ clipId: CAMERA_LANE, prop: 'rotateY', frame: 0 }])).camera!.keyframes.rotateY!.map((k) => k.frame)).toEqual([45]);
  });

  it('a clip takes a depth and a space; a depth out of range is refused', () => {
    const doc = must(setClipDepth(layered(), 'title', { depth: -200, space: Space.Screen }));

    expect(findClip(doc, 'title')!.clip).toMatchObject({ depth: -200, space: Space.Screen });
    expect(setClipDepth(doc, 'title', { depth: 1e7 }).ok).toBe(false);
    expect(setClipDepth(doc, 'nope', { depth: 1 }).ok).toBe(false);
  });
});

describe('camera presets', () => {
  const at = { start: 30, duration: 90 };

  it('dolly in pushes the camera forward from where it is, with the ease given', () => {
    const doc = must(applyPreset(layered(), CameraPreset.DollyIn, { ...at, amount: 600, ease: Ease.Linear }));

    expect(doc.camera!.keyframes.z).toEqual([
      { frame: 30, value: 0, ease: Ease.Linear },
      { frame: 120, value: 600, ease: Ease.Linear }
    ]);
  });

  it('presets chain: a later move starts where the earlier one ended and keeps its keys', () => {
    let doc = must(applyPreset(layered(), CameraPreset.DollyIn, { start: 0, duration: 30, amount: 300 }));
    doc = must(applyPreset(doc, CameraPreset.DollyOut, { start: 60, duration: 30, amount: 100 }));

    expect(doc.camera!.keyframes.z!.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [30, 300],
      [60, 300],
      [90, 200]
    ]);
  });

  it('truck slides by its amount in px of the frame, pan turns by degrees', () => {
    const doc = layered();
    const trucked = must(applyPreset(doc, CameraPreset.Truck, { ...at, amount: 200 }));
    const panned = must(applyPreset(doc, CameraPreset.Pan, { ...at, amount: 15 }));

    expect(trucked.camera!.keyframes.x!.at(-1)!.value).toBeCloseTo(200 / doc.width, 4);
    expect(panned.camera!.keyframes.rotateY!.at(-1)!.value).toBe(15);
  });

  it('orbit keeps the target in the middle of the frame while it turns around it', () => {
    const doc = must(applyPreset(layered(), CameraPreset.Orbit, { ...at, amount: 40, target: 1200 }));
    const spec = stageSpec(doc);

    for (const frame of [30, 52, 75, 97, 120]) {
      const [x, y] = screenOf(spec, frame, [0, 0, -1200]);
      expect(Math.abs(x)).toBeLessThan(1);
      expect(Math.abs(y)).toBeLessThan(1);
    }
    expect(math.valuesAt(spec, 120).rotateY).toBeCloseTo(40, 6);
  });

  it('crane rises by its amount in px of the frame and tilts down onto the target', () => {
    const base = layered();
    const doc = must(applyPreset(base, CameraPreset.Crane, { ...at, amount: 270, target: 0 }));
    const spec = stageSpec(doc);
    const [x, y] = screenOf(spec, 120, [0, 0, 0]);

    expect(math.valuesAt(spec, 120).y).toBeCloseTo(-270 / base.height, 6);
    expect(Math.abs(x) + Math.abs(y)).toBeLessThan(1);
  });

  it('dolly zoom keeps the focused layer the same size while the background stretches', () => {
    const doc = must(applyPreset(layered(), CameraPreset.DollyZoom, { ...at, amount: 800, target: 0 }));
    const spec = stageSpec(doc);
    const size = (frame: number, depth: number) => screenOf(spec, frame, [100 * math.compensation(spec, depth), 0, -depth])[0];

    for (const frame of [30, 60, 90, 120]) {
      expect(size(frame, 0)).toBeCloseTo(100, 0);
    }
    expect(size(120, 1200)).toBeLessThan(size(30, 1200) - 5);
  });

  it('rack focus moves the focus from one clip depth to the other and turns depth of field on', () => {
    const doc = must(applyPreset(layered(), CameraPreset.RackFocus, { ...at, from: 'title', to: 'product' }));

    expect(doc.camera!.dof).toBe(true);
    expect(doc.camera!.keyframes.focusDistance!.map((k) => [k.frame, k.value])).toEqual([
      [30, 0],
      [120, 1200]
    ]);
    expect(applyPreset(layered(), CameraPreset.RackFocus, { ...at, from: 'title' })).toMatchObject({ ok: false });
    expect(applyPreset(layered(), CameraPreset.RackFocus, { ...at, from: 'title', to: 'ghost' })).toMatchObject({ ok: false });
  });

  it('a move past the end of the video is refused', () => {
    expect(applyPreset(layered(), CameraPreset.DollyIn, { start: 400, duration: 90 })).toMatchObject({ ok: false });
  });
});

describe('camera edits at the playhead', () => {
  it('a value without keyframes changes the base, a keyed one gets a key at the playhead', () => {
    let doc = must(cameraEditAt(layered(), 'fov', 30, 45));
    expect(doc.camera!.base.fov).toBe(30);

    doc = must(cameraKeyToggle(doc, 'z', 0));
    doc = must(cameraEditAt(doc, 'z', 400, 60));
    expect(doc.camera!.keyframes.z!.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [60, 400]
    ]);
    expect(cameraValueAt(doc, 'z', 30)).toBeGreaterThan(0);
    expect(must(cameraKeyToggle(doc, 'z', 60)).camera!.keyframes.z!.map((k) => k.frame)).toEqual([0]);
  });

  it('focus on a clip sets the focus distance to its depth', () => {
    const doc = must(focusOn(layered(), 'product', 0));

    expect(doc.camera!.base.focusDistance).toBe(1200);
    expect(focusOn(layered(), 'ghost', 0).ok).toBe(false);
  });
});

describe('the camera timeline lanes', () => {
  it('lists the animated camera values in table order, with their frames', () => {
    let doc = must(setCameraKeyframes(layered(), 'focusDistance', [{ frame: 10, value: 0, ease: Ease.Linear }]));
    doc = must(setCameraKeyframes(doc, 'z', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 30, value: 9, ease: Ease.Linear }]));

    expect(cameraLanes(doc.camera)).toEqual([
      { prop: 'z', label: 'Dolly Z', frames: [0, 30] },
      { prop: 'focusDistance', label: 'Focus distance', frames: [10] }
    ]);
    expect(cameraLanes(null)).toEqual([]);
  });
});
