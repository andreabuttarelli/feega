import { z } from 'zod';
import { THREE_D_COMPONENTS, TrackKind, type ComponentId } from './components';
import { keyframeSchema, type Keyframe } from './keyframes';

export enum Space {
  World = 'world',
  Screen = 'screen'
}

export const SPACES = [Space.World, Space.Screen] as const;

type Range = { label: string; min: number; max: number; step: number; fallback: number };

export const CAMERA = {
  x: { label: 'Truck X', min: -2, max: 2, step: 0.01, fallback: 0 },
  y: { label: 'Pedestal Y', min: -2, max: 2, step: 0.01, fallback: 0 },
  z: { label: 'Dolly Z', min: -4000, max: 4000, step: 1, fallback: 0 },
  rotateX: { label: 'Tilt', min: -180, max: 180, step: 1, fallback: 0 },
  rotateY: { label: 'Pan', min: -180, max: 180, step: 1, fallback: 0 },
  rotateZ: { label: 'Roll', min: -180, max: 180, step: 1, fallback: 0 },
  fov: { label: 'Field of view', min: 5, max: 120, step: 0.5, fallback: 50 },
  focusDistance: { label: 'Focus distance', min: -4000, max: 20000, step: 1, fallback: 0 },
  aperture: { label: 'Aperture', min: 0, max: 20, step: 0.1, fallback: 4 }
} as const satisfies Record<string, Range>;

export type CameraKey = keyof typeof CAMERA;
export const CAMERA_KEYS = Object.keys(CAMERA) as [CameraKey, ...CameraKey[]];
export type CameraValues = Record<CameraKey, number>;

export const DEPTH = { label: 'Depth Z', min: -1000, max: 20000, step: 1, fallback: 0 } as const satisfies Range;
export const depthSchema = z.number().min(DEPTH.min).max(DEPTH.max);

export const MAX_DOF_LAYERS = 8;

export const CAMERA_LANE = '@camera';

const ranged = (key: CameraKey) => z.number().min(CAMERA[key].min).max(CAMERA[key].max);

const cameraKeyframe = (key: CameraKey) => keyframeSchema.extend({ value: ranged(key) });

export const cameraSchema = z.object({
  base: z.object(Object.fromEntries(CAMERA_KEYS.map((k) => [k, ranged(k).optional()]))).partial().default({}) as z.ZodType<Partial<CameraValues>>,
  dof: z.boolean().default(false),
  keyframes: z.object(Object.fromEntries(CAMERA_KEYS.map((k) => [k, z.array(cameraKeyframe(k)).min(1).optional()]))).default({}) as z.ZodType<Partial<Record<CameraKey, Keyframe[]>>>
});

export type Camera = z.infer<typeof cameraSchema>;

export function newCamera(): Camera {
  return { base: {}, dof: false, keyframes: {} };
}

export function baseValues(camera: Camera): CameraValues {
  return Object.fromEntries(CAMERA_KEYS.map((k) => [k, camera.base[k] ?? CAMERA[k].fallback])) as CameraValues;
}

export enum LayerKind {
  Flat = 'flat',
  Billboard = 'billboard'
}

export type StageLayer = { id: string; depth: number; kind: `${LayerKind}`; dof: boolean };

export type StageSpec = {
  width: number;
  height: number;
  rest: number;
  dof: boolean;
  base: CameraValues;
  keyframes: Partial<Record<CameraKey, Keyframe[]>>;
  layers: StageLayer[];
};

type StageClip = { id: string; component: ComponentId; depth: number; space: Space; props: Record<string, unknown> };

const LOOKS_THE_SAME_BLURRED: Partial<Record<ComponentId, (props: Record<string, unknown>) => boolean>> = {
  BrandBackground: (props) => props.pattern === 'solid'
};

const blurrable = (c: StageClip) => !THREE_D_COMPONENTS.includes(c.component) && !LOOKS_THE_SAME_BLURRED[c.component]?.(c.props);
type StageDoc = { width: number; height: number; camera: Camera | null; tracks?: { kind: string; clips: unknown[] }[] };

function stageClips(doc: StageDoc): StageClip[] {
  const bottomFirst = [...(doc.tracks ?? [])].reverse().filter((t) => t.kind === TrackKind.Visual);
  return bottomFirst.flatMap((t) => t.clips as StageClip[]).filter((c) => c.space === Space.World);
}

export function stageSpec(doc: StageDoc): StageSpec {
  const camera = doc.camera ?? newCamera();
  const base = baseValues(camera);
  let dofSlots = MAX_DOF_LAYERS;
  const layers = stageClips(doc).map((c): StageLayer => {
    const billboard = THREE_D_COMPONENTS.includes(c.component);
    const dof = blurrable(c) && dofSlots > 0;
    dofSlots -= dof ? 1 : 0;
    return { id: c.id, depth: c.depth, kind: billboard ? LayerKind.Billboard : LayerKind.Flat, dof };
  });
  return { width: doc.width, height: doc.height, rest: cameraMath(() => 0).perspectiveOf(base.fov, doc.height), dof: camera.dof, base, keyframes: camera.keyframes, layers };
}

type Sampler = (track: Keyframe[], frame: number) => number;

export function cameraMath(sample: Sampler) {
  const DEG = Math.PI / 180;
  const MIN_BLUR = 0.5;
  const MAX_BLUR = 40;
  const BLUR_UNIT = 100;
  const MIN_SCALE = 0.05;

  type M = number[];
  type Spec = StageSpec;
  type V = CameraValues;

  const round = (n: number) => Math.round(n * 1e6) / 1e6;

  const perspectiveOf = (fov: number, height: number) => height / 2 / Math.tan((fov * DEG) / 2);

  const mul = (a: M, b: M): M => {
    const out = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + r] * b[c * 4 + k];
        }
        out[c * 4 + r] = sum;
      }
    }
    return out;
  };

  const translate = (x: number, y: number, z: number): M => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const scale = (s: number): M => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];

  const rotX = (deg: number): M => {
    const c = Math.cos(deg * DEG);
    const s = Math.sin(deg * DEG);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  };

  const rotY = (deg: number): M => {
    const c = Math.cos(deg * DEG);
    const s = Math.sin(deg * DEG);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  };

  const rotZ = (deg: number): M => {
    const c = Math.cos(deg * DEG);
    const s = Math.sin(deg * DEG);
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  };

  const chain = (...ms: M[]) => ms.reduce(mul).map(round);

  const valuesAt = (spec: Spec, frame: number): V => {
    const out = { ...spec.base };
    for (const key of Object.keys(spec.keyframes) as (keyof V)[]) {
      const track = spec.keyframes[key];
      if (track && track.length) {
        out[key] = sample(track, frame);
      }
    }
    return out;
  };

  const cameraPosition = (v: V, spec: Spec) => [v.x * spec.width, v.y * spec.height, spec.rest - v.z];

  const worldMatrix = (v: V, spec: Spec): M => {
    const [cx, cy, cz] = cameraPosition(v, spec);
    return chain(translate(0, 0, perspectiveOf(v.fov, spec.height)), rotZ(-v.rotateZ), rotX(-v.rotateX), rotY(-v.rotateY), translate(-cx, -cy, -cz));
  };

  const compensation = (spec: Spec, depth: number) => Math.max(MIN_SCALE, (spec.rest + depth) / spec.rest);

  const billboardMatrix = (v: V, spec: Spec, depth: number): M => chain(translate(0, 0, -depth), rotY(v.rotateY), rotX(v.rotateX), rotZ(v.rotateZ), scale(compensation(spec, depth)));

  const dofBlur = (aperture: number, depth: number, focus: number) => {
    const blur = Math.min(MAX_BLUR, (aperture * Math.abs(depth - focus)) / BLUR_UNIT);
    return blur < MIN_BLUR ? 0 : Math.round(blur * 100) / 100;
  };

  const flatTransform = (spec: Spec, depth: number) => `translate3d(0px,0px,${round(-depth)}px) scale(${round(compensation(spec, depth))})`;

  const matrixCss = (m: M) => `matrix3d(${m.join(',')})`;

  const frameAt = (spec: Spec, frame: number) => {
    const v = valuesAt(spec, frame);
    return {
      perspective: round(perspectiveOf(v.fov, spec.height)),
      world: worldMatrix(v, spec),
      layers: spec.layers.map((l) => ({
        id: l.id,
        transform: l.kind === 'billboard' ? matrixCss(billboardMatrix(v, spec, l.depth)) : flatTransform(spec, l.depth),
        blur: spec.dof && l.dof ? dofBlur(v.aperture, l.depth, v.focusDistance) : 0
      }))
    };
  };

  const orbitView = (v: V, spec: Spec, depth: number) => {
    const [cx, cy, cz] = cameraPosition(v, spec);
    const dx = cx;
    const dy = cy;
    const dz = cz + depth;
    const length = Math.hypot(dx, dy, dz) || 1;
    const up = mul(rotY(v.rotateY), mul(rotX(v.rotateX), mul(rotZ(v.rotateZ), [0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])));
    return { direction: [dx / length, -dy / length, dz / length].map(round), up: [up[0], -up[1], up[2]].map(round), distance: length };
  };

  return { MAX_BLUR, perspectiveOf, valuesAt, worldMatrix, billboardMatrix, dofBlur, flatTransform, matrixCss, frameAt, orbitView, compensation };
}
