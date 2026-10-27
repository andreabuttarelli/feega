import { z } from 'zod';
import { THREE_D_COMPONENTS, TrackKind, type ComponentId } from './components';
import { keyframeSchema, type Keyframe } from './keyframes';
import { BlendMode } from './blend';
import { MAX_SOURCE } from './expression/language';
import { STAGE_LIGHT, STAGE_LIGHT_COLOUR, STAGE_LIGHT_KEYS, StageLightKind } from './lights';

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
  keyframes: z.object(Object.fromEntries(CAMERA_KEYS.map((k) => [k, z.array(cameraKeyframe(k)).min(1).optional()]))).default({}) as z.ZodType<Partial<Record<CameraKey, Keyframe[]>>>,
  expressions: z.object(Object.fromEntries(CAMERA_KEYS.map((k) => [k, z.string().max(MAX_SOURCE).optional()]))).default({}) as z.ZodType<Partial<Record<CameraKey, string>>>
});

export type Camera = z.infer<typeof cameraSchema>;

export function newCamera(): Camera {
  return { base: {}, dof: false, keyframes: {}, expressions: {} };
}

export function baseValues(camera: Camera): CameraValues {
  return Object.fromEntries(CAMERA_KEYS.map((k) => [k, camera.base[k] ?? CAMERA[k].fallback])) as CameraValues;
}

export enum LayerKind {
  Flat = 'flat',
  Billboard = 'billboard'
}

export enum Composite {
  World = 'world',
  Projected = 'projected'
}

export const TURN_KEYS = ['rotateX', 'rotateY', 'rotateZ'] as const;

export type StageTurn = { from: number; base: Record<(typeof TURN_KEYS)[number], number>; keyframes: Partial<Record<string, Keyframe[]>> };

export type StageLayer = { id: string; depth: number; kind: `${LayerKind}`; dof: boolean; composite: `${Composite}`; lit?: StageTurn };

export type StageLight = {
  from: number;
  to: number;
  kind: `${StageLightKind}`;
  color: string;
  depth: number;
  base: Record<string, number>;
  keyframes: Partial<Record<string, Keyframe[]>>;
};

export type StageSpec = {
  width: number;
  height: number;
  rest: number;
  dof: boolean;
  base: CameraValues;
  keyframes: Partial<Record<CameraKey, Keyframe[]>>;
  layers: StageLayer[];
  lights?: StageLight[];
};

type StageClip = {
  id: string;
  component: ComponentId;
  from: number;
  durationInFrames: number;
  depth: number;
  space: Space;
  props: Record<string, unknown>;
  transform: Record<string, number | undefined>;
  keyframes: Record<string, Keyframe[]>;
  blend?: string;
  hidden?: boolean;
  acceptsLights?: boolean;
};

const LOOKS_THE_SAME_BLURRED: Partial<Record<ComponentId, (props: Record<string, unknown>) => boolean>> = {
  BrandBackground: (props) => props.pattern === 'solid'
};

const blurrable = (c: StageClip) => !THREE_D_COMPONENTS.includes(c.component) && !LOOKS_THE_SAME_BLURRED[c.component]?.(c.props);
type StageDoc = { width: number; height: number; camera: Camera | null; tracks?: { kind: string; hidden?: boolean; clips: unknown[] }[] };

const LIGHT_COMPONENT: ComponentId = 'Light';

function shownClips(doc: StageDoc): StageClip[] {
  const bottomFirst = [...(doc.tracks ?? [])].reverse().filter((t) => t.kind === TrackKind.Visual && !t.hidden);
  return bottomFirst.flatMap((t) => t.clips as StageClip[]).filter((c) => !c.hidden);
}

function stageClips(doc: StageDoc): StageClip[] {
  return shownClips(doc).filter((c) => c.space === Space.World && c.component !== LIGHT_COMPONENT);
}

const numberOf = (value: unknown, fallback: number) => (typeof value === 'number' ? value : fallback);

function stageLights(doc: StageDoc): StageLight[] {
  return shownClips(doc)
    .filter((c) => c.component === LIGHT_COMPONENT)
    .map((c) => ({
      from: c.from,
      to: c.from + c.durationInFrames,
      kind: (c.props.kind ?? StageLightKind.Point) as `${StageLightKind}`,
      color: String(c.props[STAGE_LIGHT_COLOUR.key] ?? STAGE_LIGHT_COLOUR.fallback),
      depth: c.depth,
      base: {
        ...Object.fromEntries(STAGE_LIGHT_KEYS.map((k) => [k, numberOf(c.props[k], STAGE_LIGHT[k].fallback)])),
        ...Object.fromEntries(['x', 'y', 'z', 'rotateX', 'rotateY'].map((k) => [k, numberOf(c.transform[k], 0)]))
      },
      keyframes: c.keyframes
    }));
}

const turnOf = (c: StageClip): StageTurn => ({ from: c.from, base: Object.fromEntries(TURN_KEYS.map((k) => [k, numberOf(c.transform[k], 0)])) as StageTurn['base'], keyframes: c.keyframes });

export function stageSpec(doc: StageDoc): StageSpec {
  const camera = doc.camera ?? newCamera();
  const base = baseValues(camera);
  let dofSlots = MAX_DOF_LAYERS;
  const layers = stageClips(doc).map((c): StageLayer => {
    const billboard = THREE_D_COMPONENTS.includes(c.component);
    const dof = blurrable(c) && dofSlots > 0;
    dofSlots -= dof ? 1 : 0;
    const composite = (c.blend ?? BlendMode.Normal) === BlendMode.Normal ? Composite.World : Composite.Projected;
    const accepts = !billboard && c.acceptsLights !== false;
    return { id: c.id, depth: c.depth, kind: billboard ? LayerKind.Billboard : LayerKind.Flat, dof, composite, ...(accepts ? { lit: turnOf(c) } : {}) };
  });
  const lights = stageLights(doc);
  return { width: doc.width, height: doc.height, rest: cameraMath(() => 0).perspectiveOf(base.fov, doc.height), dof: camera.dof, base, keyframes: camera.keyframes, layers, ...(lights.length ? { lights } : {}) };
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

  const LIT_MAX = 2;
  const LIGHT_KINDS = { ambient: 'ambient', point: 'point', spot: 'spot', parallel: 'parallel' };

  const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16) / 255);

  const numberAt = (base: number, track: Keyframe[] | undefined, frame: number) => (track && track.length ? sample(track, frame) : base);

  const colourAt = (light: StageLight, frame: number) => {
    const track = light.keyframes.color;
    if (!track || !track.length) {
      return channels(light.color);
    }
    const next = track.findIndex((k) => k.frame >= frame);
    if (next === -1) {
      return channels(String(track[track.length - 1].value));
    }
    if (next === 0 || track[next].frame === frame) {
      return channels(String(track[next].value));
    }
    const from = channels(String(track[next - 1].value));
    const to = channels(String(track[next].value));
    const t = (frame - track[next - 1].frame) / (track[next].frame - track[next - 1].frame);
    return from.map((v, i) => v + (to[i] - v) * t);
  };

  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const unit = (v: number[]) => {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  };

  const aimOf = (rx: number, ry: number) => [Math.cos(rx * DEG) * Math.sin(ry * DEG), Math.sin(rx * DEG), Math.cos(rx * DEG) * Math.cos(ry * DEG)];

  const normalOf = (rx: number, ry: number, rz: number) => {
    const sx = Math.sin(rx * DEG);
    const cx = Math.cos(rx * DEG);
    const sy = Math.sin(ry * DEG);
    const cy = Math.cos(ry * DEG);
    const sz = Math.sin(rz * DEG);
    const cz = Math.cos(rz * DEG);
    const x = sy * cx;
    const y = -sx;
    const z = cy * cx;
    return [cz * x - sz * y, sz * x + cz * y, -z];
  };

  const smooth = (edge: number, inner: number, angle: number) => (angle >= edge ? 0 : angle <= inner ? 1 : (edge - angle) / (edge - inner));

  const reach = (light: StageLight, spec: Spec, frame: number, depth: number, normal: number[]) => {
    const at = frame - light.from;
    const pick = (key: string) => numberAt(light.base[key], light.keyframes[key], at);
    if (light.kind === LIGHT_KINDS.ambient) {
      return 1;
    }
    const aim = aimOf(pick('rotateX'), pick('rotateY'));
    const position = [pick('x') * spec.width, pick('y') * spec.height, light.depth + pick('z')];
    const toLight = light.kind === LIGHT_KINDS.parallel ? aim.map((v) => -v) : [position[0], position[1], position[2] - depth];
    const lambert = Math.max(0, dot(normal, unit(toLight)));
    if (light.kind === LIGHT_KINDS.parallel) {
      return lambert;
    }
    const distance = Math.hypot(toLight[0], toLight[1], toLight[2]);
    const radius = pick('falloff');
    const fade = radius > 0 ? 1 / (1 + (distance / radius) ** 2) : 1;
    if (light.kind === LIGHT_KINDS.point) {
      return lambert * fade;
    }
    const angle = Math.acos(Math.min(1, Math.max(-1, dot(aim, unit(toLight.map((v) => -v)))))) / DEG;
    const half = pick('coneAngle') / 2;
    return lambert * fade * smooth(half, half * (1 - pick('coneFeather')), angle);
  };

  const litBy = (spec: Spec, layer: StageLayer, frame: number): number[] | null => {
    const lights = (spec.lights ?? []).filter((l) => frame >= l.from && frame < l.to);
    if (!layer.lit || !lights.length) {
      return null;
    }
    const turn = layer.lit;
    const at = frame - turn.from;
    const rotation = (key: string) => numberAt(turn.base[key as 'rotateX'], turn.keyframes[key], at);
    const normal = normalOf(rotation('rotateX'), rotation('rotateY'), rotation('rotateZ'));
    const sum = [0, 0, 0];
    for (const light of lights) {
      const strength = numberAt(light.base.intensity, light.keyframes.intensity, frame - light.from) * reach(light, spec, frame, layer.depth, normal);
      colourAt(light, frame - light.from).forEach((c, i) => {
        sum[i] += c * strength;
      });
    }
    return sum.map((v) => round(Math.min(LIT_MAX, Math.max(0, v))));
  };

  const flatTransform = (spec: Spec, depth: number) => `translate3d(0px,0px,${round(-depth)}px) scale(${round(compensation(spec, depth))})`;

  const matrixCss = (m: M) => `matrix3d(${m.join(',')})`;

  const frameAt = (spec: Spec, frame: number) => {
    const v = valuesAt(spec, frame);
    const perspective = round(perspectiveOf(v.fov, spec.height));
    const world = worldMatrix(v, spec);
    const own = (l: StageLayer) => (l.kind === 'billboard' ? matrixCss(billboardMatrix(v, spec, l.depth)) : flatTransform(spec, l.depth));
    return {
      perspective,
      world,
      layers: spec.layers.map((l) => ({
        id: l.id,
        transform: l.composite === 'projected' ? `${matrixCss(world)} ${own(l)}` : own(l),
        blur: spec.dof && l.dof ? dofBlur(v.aperture, l.depth, v.focusDistance) : 0,
        light: litBy(spec, l, frame)
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
