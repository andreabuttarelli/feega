import { CAMERA, CAMERA_KEYS, cameraMath, cameraSchema, depthSchema, newCamera, stageSpec, type Camera, type CameraKey, type CameraValues, type Space } from './camera';
import { Ease, FPS } from './design';
import { byFrame, findClip, type DocVerdict, type MotionDoc } from './doc';
import { sampleTrack, type EaseSpec, type KeyValue, type Keyframe } from './keyframes';

const fail = (error: string): DocVerdict => ({ ok: false, error });

const issues = (error: { issues: { path: PropertyKey[]; message: string }[] }) => error.issues.map((i) => `${i.path.join('.') || 'camera'}: ${i.message}`).join('; ');

function withCamera(doc: MotionDoc, camera: Camera): DocVerdict {
  const parsed = cameraSchema.safeParse(camera);
  return parsed.success ? { ok: true, doc: { ...doc, camera: parsed.data } } : fail(issues(parsed.error));
}

export function setCamera(doc: MotionDoc, patch: { base?: Partial<CameraValues>; dof?: boolean }): DocVerdict {
  const camera = doc.camera ?? newCamera();
  return withCamera(doc, { ...camera, base: { ...camera.base, ...patch.base }, dof: patch.dof ?? camera.dof });
}

export function removeCamera(doc: MotionDoc): DocVerdict {
  return { ok: true, doc: { ...doc, camera: null } };
}

export function editCameraLane(doc: MotionDoc, key: CameraKey, edit: (track: Keyframe[]) => Keyframe[]): DocVerdict {
  const camera = doc.camera ?? newCamera();
  const next = byFrame(edit(camera.keyframes[key] ?? []).map((k) => ({ ...k, frame: Math.max(0, Math.round(k.frame)) })));
  const keyframes = { ...camera.keyframes, [key]: next };
  if (!next.length) {
    delete keyframes[key];
  }
  return withCamera(doc, { ...camera, keyframes });
}

export function setCameraKeyframes(doc: MotionDoc, key: CameraKey, track: Keyframe[]): DocVerdict {
  return editCameraLane(doc, key, () => track);
}

export function setCameraKeyframe(doc: MotionDoc, key: CameraKey, frame: number, value: KeyValue): DocVerdict {
  const at = Math.max(0, Math.round(frame));
  return editCameraLane(doc, key, (track) => {
    const ease = track.find((k) => k.frame === at)?.ease ?? Ease.Standard;
    return [...track.filter((k) => k.frame !== at), { frame: at, value, ease }];
  });
}

export function removeCameraKeyframes(doc: MotionDoc, key: CameraKey, frames?: readonly number[]): DocVerdict {
  return editCameraLane(doc, key, (track) => (frames ? track.filter((k) => !frames.includes(k.frame)) : []));
}

export function cameraValueAt(doc: MotionDoc, key: CameraKey, frame: number): number {
  return cameraMath(sampleTrack).valuesAt(stageSpec(doc), frame)[key];
}

export function cameraEditAt(doc: MotionDoc, key: CameraKey, value: number, frame: number): DocVerdict {
  if (doc.camera?.keyframes[key]?.length) {
    return setCameraKeyframe(doc, key, frame, value);
  }
  return setCamera(doc, { base: { [key]: value } });
}

export function cameraKeyToggle(doc: MotionDoc, key: CameraKey, frame: number): DocVerdict {
  const at = Math.max(0, Math.round(frame));
  if (doc.camera?.keyframes[key]?.some((k) => k.frame === at)) {
    return removeCameraKeyframes(doc, key, [at]);
  }
  return setCameraKeyframe(doc, key, at, cameraValueAt(doc, key, at));
}

export function focusOn(doc: MotionDoc, clipId: string, frame: number): DocVerdict {
  const clip = findClip(doc, clipId)?.clip;
  return clip ? cameraEditAt(doc, 'focusDistance', clip.depth, frame) : fail(`no clip ${clipId}`);
}

export type CameraLane = { prop: CameraKey; label: string; frames: number[] };

export function cameraLanes(camera: Camera | null): CameraLane[] {
  return CAMERA_KEYS.filter((k) => camera?.keyframes[k]?.length).map((k) => ({ prop: k, label: CAMERA[k].label, frames: camera!.keyframes[k]!.map((f) => f.frame) }));
}

export function setClipDepth(doc: MotionDoc, clipId: string, patch: { depth?: number; space?: Space }): DocVerdict {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  const depth = depthSchema.safeParse(patch.depth ?? found.clip.depth);
  if (!depth.success) {
    return fail(`depth: ${issues(depth.error)}`);
  }
  const clip = { ...found.clip, depth: depth.data, space: patch.space ?? found.clip.space };
  return { ok: true, doc: { ...doc, tracks: doc.tracks.map((t) => (t.id === found.track.id ? { ...t, clips: t.clips.map((c) => (c.id === clipId ? clip : c)) } : t)) } };
}

export enum CameraPreset {
  DollyIn = 'dolly-in',
  DollyOut = 'dolly-out',
  Truck = 'truck',
  Pan = 'pan',
  Orbit = 'orbit',
  Crane = 'crane',
  DollyZoom = 'dolly-zoom',
  RackFocus = 'rack-focus'
}

export const CAMERA_PRESETS = Object.values(CameraPreset) as [CameraPreset, ...CameraPreset[]];

export type PresetParams = { start: number; duration: number; ease?: EaseSpec; amount?: number; target?: number; from?: string; to?: string };

type Move = { origin: CameraValues; amount: number; target: number; rest: number; width: number; height: number };
type Pose = Partial<CameraValues>;
type Lanes = Partial<Record<CameraKey, Keyframe[]>>;
type Ctx = { doc: MotionDoc; params: PresetParams; start: number; end: number };

enum Path {
  Straight = 'straight',
  Curved = 'curved'
}

export enum Focus {
  Keep = 'keep',
  On = 'on'
}

type PresetSpec = { label: string; about: string; amount: number; focus: Focus; lanes: (ctx: Ctx, amount: number) => Lanes | string };

const DEG = Math.PI / 180;
const CURVE_SEGMENTS = 16;

function orbitPose(m: Move, e: number): Pose {
  const angle = m.amount * e;
  const reach = m.rest - m.origin.z + m.target;
  return {
    x: m.origin.x + (reach * Math.sin(angle * DEG)) / m.width,
    z: m.origin.z + reach * (1 - Math.cos(angle * DEG)),
    rotateY: m.origin.rotateY + angle
  };
}

function cranePose(m: Move, e: number): Pose {
  const rise = m.amount * e;
  const reach = m.rest - m.origin.z + m.target;
  return { y: m.origin.y - rise, rotateX: m.origin.rotateX + Math.atan2(rise * m.height, reach) / DEG };
}

function dollyZoomPose(m: Move, e: number): Pose {
  const z = m.origin.z + m.amount * e;
  const anchor = cameraMath(sampleTrack).perspectiveOf(m.origin.fov, m.height) / (m.rest - m.origin.z + m.target);
  const perspective = anchor * (m.rest - z + m.target);
  return { z, fov: (2 * Math.atan(m.height / 2 / perspective)) / DEG };
}

const round = (n: number) => Math.round(n * 10000) / 10000;

function progressOf(ease: EaseSpec, p: number): number {
  return sampleTrack([{ frame: 0, value: 0, ease }, { frame: 1, value: 1, ease: Ease.Linear }], p);
}

function steps(path: Path, ctx: Ctx): { frame: number; progress: number; ease: EaseSpec }[] {
  const ease = ctx.params.ease ?? Ease.Standard;
  const duration = ctx.end - ctx.start;
  if (path === Path.Straight) {
    return [
      { frame: ctx.start, progress: 0, ease },
      { frame: ctx.end, progress: 1, ease: Ease.Linear }
    ];
  }
  const segments = Math.max(1, Math.min(CURVE_SEGMENTS, duration));
  return Array.from({ length: segments + 1 }, (_, i) => ({ frame: ctx.start + Math.round((i * duration) / segments), progress: progressOf(ease, i / segments), ease: Ease.Linear }));
}

const moved =
  (path: Path, pose: (m: Move, e: number) => Pose) =>
  (ctx: Ctx, amount: number): Lanes => {
    const stage = stageSpec(ctx.doc);
    const move: Move = {
      origin: cameraMath(sampleTrack).valuesAt(stage, ctx.start),
      amount,
      target: ctx.params.target ?? ctx.doc.camera?.base.focusDistance ?? CAMERA.focusDistance.fallback,
      rest: stage.rest,
      width: ctx.doc.width,
      height: ctx.doc.height
    };
    const lanes: Lanes = {};
    for (const { frame, progress, ease } of steps(path, ctx)) {
      for (const [key, value] of Object.entries(pose(move, progress)) as [CameraKey, number][]) {
        lanes[key] = [...(lanes[key] ?? []), { frame, value: round(value), ease }];
      }
    }
    return lanes;
  };

function depthOf(doc: MotionDoc, clipId: string | undefined, side: string): number | string {
  if (!clipId) {
    return `rack-focus needs ${side}: a clip id`;
  }
  const clip = findClip(doc, clipId)?.clip;
  return clip ? clip.depth : `no clip ${clipId}`;
}

function rackFocus(ctx: Ctx): Lanes | string {
  const from = depthOf(ctx.doc, ctx.params.from, 'from');
  const to = depthOf(ctx.doc, ctx.params.to, 'to');
  if (typeof from === 'string' || typeof to === 'string') {
    return [from, to].filter((x) => typeof x === 'string').join('; ');
  }
  return {
    focusDistance: [
      { frame: ctx.start, value: from, ease: ctx.params.ease ?? Ease.Standard },
      { frame: ctx.end, value: to, ease: Ease.Linear }
    ]
  };
}

export const PRESETS: Record<CameraPreset, PresetSpec> = {
  [CameraPreset.DollyIn]: { label: 'Dolly in', about: 'the camera pushes forward (amount: pixels)', amount: 600, focus: Focus.Keep, lanes: moved(Path.Straight, (m, e) => ({ z: m.origin.z + m.amount * e })) },
  [CameraPreset.DollyOut]: { label: 'Dolly out', about: 'the camera pulls back (amount: pixels)', amount: 600, focus: Focus.Keep, lanes: moved(Path.Straight, (m, e) => ({ z: m.origin.z - m.amount * e })) },
  [CameraPreset.Truck]: { label: 'Truck', about: 'the camera slides sideways (amount: fraction of the frame width, negative goes left)', amount: 0.15, focus: Focus.Keep, lanes: moved(Path.Straight, (m, e) => ({ x: m.origin.x + m.amount * e })) },
  [CameraPreset.Pan]: { label: 'Pan', about: 'the camera turns on the spot (amount: degrees, negative turns left)', amount: 12, focus: Focus.Keep, lanes: moved(Path.Straight, (m, e) => ({ rotateY: m.origin.rotateY + m.amount * e })) },
  [CameraPreset.Orbit]: { label: 'Orbit', about: 'the camera circles the target depth and keeps it centred (amount: degrees)', amount: 30, focus: Focus.Keep, lanes: moved(Path.Curved, orbitPose) },
  [CameraPreset.Crane]: { label: 'Crane', about: 'the camera rises and tilts down onto the target (amount: fraction of the frame height)', amount: 0.2, focus: Focus.Keep, lanes: moved(Path.Curved, cranePose) },
  [CameraPreset.DollyZoom]: { label: 'Dolly zoom', about: 'vertigo: the camera pushes in while zooming out, the target keeps its size (amount: pixels)', amount: 700, focus: Focus.Keep, lanes: moved(Path.Curved, dollyZoomPose) },
  [CameraPreset.RackFocus]: { label: 'Rack focus', about: 'focus moves from the depth of clip `from` to clip `to`; turns depth of field on', amount: 0, focus: Focus.On, lanes: rackFocus }
};

export function applyPreset(doc: MotionDoc, preset: CameraPreset, params: PresetParams): DocVerdict {
  const start = Math.max(0, Math.round(params.start));
  const end = start + Math.max(1, Math.round(params.duration));
  if (end > doc.durationInFrames) {
    return fail(`the move ends at ${round(end / FPS)}s, after the end of the video (${round(doc.durationInFrames / FPS)}s)`);
  }

  const spec = PRESETS[preset];
  const lanes = spec.lanes({ doc, params, start, end }, params.amount ?? spec.amount);
  if (typeof lanes === 'string') {
    return fail(lanes);
  }

  const camera = doc.camera ?? newCamera();
  const keyframes = { ...camera.keyframes };
  for (const [key, track] of Object.entries(lanes) as [CameraKey, Keyframe[]][]) {
    const kept = (keyframes[key] ?? []).filter((k) => k.frame < start || k.frame > end);
    keyframes[key] = byFrame([...kept, ...track]);
  }
  return withCamera(doc, { ...camera, dof: camera.dof || spec.focus === Focus.On, keyframes });
}
