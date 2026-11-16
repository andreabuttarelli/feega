import { Space } from '../camera';
import type { MotionClip } from '../doc';
import { SURFACE, type Material, type Surface } from '../materials';
import { SCENE, sampleTrack, type Keyframe } from '../keyframes';

export const SCENE_COMPONENTS = ['Model3D', 'Shape3D'] as const;

export const isScene = (component: string) => (SCENE_COMPONENTS as readonly string[]).includes(component);

export const RIG = {
  fit: 2,
  height: 0.3,
  distance: 4.6,
  floor: -1.05,
  key: [3, 4, 5],
  fill: [-4, 2, -3],
  near: 0.1,
  far: 100,
  tilt: [0.35, 0, 0.1],
  shapeRoughness: 0.35,
  shapeMetalness: 0.1,
  shadowRadius: 1.1,
  shadowSegments: 48,
  shadowOpacity: 0.22,
  maxPixelRatio: 2
};

const LIGHTS: Record<string, { ambient: number; key: number; fill: number }> = {
  studio: { ambient: 2.6, key: 3, fill: 1 },
  soft: { ambient: 3.4, key: 1.2, fill: 1.2 },
  dramatic: { ambient: 0.6, key: 5, fill: 0.2 }
};

const DEFAULT_LIGHT = 'studio';

const GEOMETRY: Record<string, { kind: string; args: number[] }> = {
  cube: { kind: 'BoxGeometry', args: [1.4, 1.4, 1.4] },
  sphere: { kind: 'SphereGeometry', args: [0.95, 64, 64] },
  torus: { kind: 'TorusGeometry', args: [0.8, 0.32, 48, 128] },
  cone: { kind: 'ConeGeometry', args: [0.9, 1.6, 64] }
};

const BACKDROP: Record<string, string | null> = { transparent: null, brand: 'brand.background', dark: '#0a0a0a', light: '#f5f5f3' };

type SceneKey = keyof typeof SCENE;

const CHANNELS: Record<string, SceneKey> = { orbit: 'orbit', dolly: 'dolly', fov: 'fov', rotateX: 'objectRotateX', rotateY: 'objectRotateY', rotateZ: 'objectRotateZ' };

const DECIMALS = 10000;

const round = (n: number) => Math.round(n * DECIMALS) / DECIMALS;

export type Channel = number | number[];

export type SceneSpec = {
  src: string | null;
  geometry: { kind: string; args: number[] } | null;
  colour: string;
  surface: Surface | null;
  light: { ambient: number; key: number; fill: number };
  shadow: boolean;
  fps: number;
  frames: number;
  loop: boolean;
  orbit: Channel;
  dolly: Channel;
  fov: Channel;
  rotateX: Channel;
  rotateY: Channel;
  rotateZ: Channel;
  rig: typeof RIG;
};

export type SceneInput = {
  timeline: { fps: number; start: number; length: number; loop: boolean };
  label: string;
  notes: Set<string>;
  asset: (id: string) => string;
  hex: (value: string) => string;
  look: boolean;
  camera: boolean;
};

export type SceneMade = { spec: SceneSpec; backdrop: string | null };

type Props = { assetId?: string | null; shape?: string; fill?: string; material: Material; startAngle: number; endAngle: number; orbitSpeed: number; zoom: number; lighting: string; backdrop: string; shadow: boolean; easing: string };

const keysOf = (clip: MotionClip, key: SceneKey): Keyframe[] | undefined => {
  const keys = clip.keyframes[key];
  return keys?.length ? keys : undefined;
};

export function withoutSceneKeys(clip: MotionClip): MotionClip {
  return { ...clip, keyframes: Object.fromEntries(Object.entries(clip.keyframes).filter(([key]) => !(key in SCENE))) };
}

function sampled(frames: number, valueAt: (frame: number) => number): Channel {
  const values = Array.from({ length: frames + 1 }, (_, frame) => round(valueAt(frame)));
  return values.every((v) => v === values[0]) ? values[0] : values;
}

const easedAt = (easing: string, progress: number) => sampleTrack([{ frame: 0, value: 0, ease: easing }, { frame: 1, value: 1, ease: 'linear' }], progress);

function channelsOf(clip: MotionClip, props: Props, input: SceneInput): Pick<SceneSpec, 'orbit' | 'dolly' | 'fov' | 'rotateX' | 'rotateY' | 'rotateZ'> {
  const { timeline } = input;
  const seconds = clip.durationInFrames / input.timeline.fps;
  const legacy: Record<SceneKey, (local: number) => number> = {
    orbit: (local) => props.startAngle + (props.endAngle - props.startAngle) * easedAt(props.easing, seconds > 0 ? local / seconds : 1) + props.orbitSpeed * local,
    dolly: () => props.zoom,
    fov: () => SCENE.fov.fallback,
    objectRotateX: () => 0,
    objectRotateY: () => 0,
    objectRotateZ: () => 0
  };
  const channel = (key: SceneKey) =>
    sampled(timeline.length, (frame) => {
      const local = Math.min(Math.max(timeline.start + frame - clip.from, 0), clip.durationInFrames);
      const keys = keysOf(clip, key);
      return keys ? sampleTrack(keys, local) : legacy[key](local / input.timeline.fps);
    });
  return Object.fromEntries(Object.entries(CHANNELS).map(([name, key]) => [name, channel(key)])) as ReturnType<typeof channelsOf>;
}

export function sceneOf(clip: MotionClip, input: SceneInput): SceneMade | null {
  const props = clip.props as unknown as Props;
  const model = clip.component === 'Model3D';
  if (model && !props.assetId) {
    input.notes.add(`${input.label}: no 3D model is picked, so the layer was left out.`);
    return null;
  }
  if (input.look) {
    input.notes.add(`${input.label}: the video's lighting look (environment, custom lights, soft shadows) is not exported; the preset lights are used.`);
  }
  if (input.camera && clip.space === Space.World) {
    input.notes.add(`${input.label}: the video camera does not move this 3D layer in code; it keeps its own camera.`);
  }
  const backdrop = BACKDROP[props.backdrop] ?? null;
  if (backdrop) {
    input.notes.add(`${input.label}: the canvas paints this layer's background over the whole frame; in code it fills only the layer box.`);
  }
  const spec: SceneSpec = {
    src: model ? input.asset(props.assetId!) : null,
    geometry: model ? null : (GEOMETRY[props.shape ?? 'cube'] ?? GEOMETRY.cube),
    colour: input.hex(props.fill ?? 'brand.accent'),
    surface: SURFACE[props.material] ?? null,
    light: LIGHTS[props.lighting] ?? LIGHTS[DEFAULT_LIGHT],
    shadow: props.shadow,
    fps: input.timeline.fps,
    frames: input.timeline.length,
    loop: input.timeline.loop,
    ...channelsOf(clip, props, input),
    rig: RIG
  };
  return { spec, backdrop };
}
