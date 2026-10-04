import { cameraMath, stageSpec } from './camera';
import { findClip, type MotionDoc } from './doc';
import { sampleTrack } from './keyframes';

const MARGIN = 0.12;
const DEG = Math.PI / 180;

export type MapLayer = { id: string; depth: number; half: number; shown: boolean };

export type SceneMap = {
  rest: number;
  camera: { x: number; depth: number; yaw: number; halfFov: number };
  focus: number;
  dof: boolean;
  layers: MapLayer[];
  box: { left: number; top: number; width: number; height: number };
};

export function sceneMap(doc: MotionDoc, frame: number): SceneMap | null {
  if (!doc.camera) {
    return null;
  }
  const spec = stageSpec(doc);
  const math = cameraMath(sampleTrack);
  const v = math.valuesAt(spec, frame);
  const perspective = math.perspectiveOf(v.fov, doc.height);

  const layers = spec.layers.map((l) => {
    const clip = findClip(doc, l.id)!.clip;
    return { id: l.id, depth: l.depth, half: (doc.width / 2) * math.compensation(spec, l.depth), shown: frame >= clip.from && frame < clip.from + clip.durationInFrames };
  });
  const camera = { x: v.x * doc.width, depth: -(spec.rest - v.z), yaw: v.rotateY, halfFov: Math.atan(doc.width / 2 / perspective) / DEG };

  const xs = [camera.x, ...layers.flatMap((l) => [-l.half, l.half])];
  const depths = [camera.depth, v.focusDistance, ...layers.map((l) => l.depth)];
  const left = Math.min(...xs);
  const top = Math.min(...depths);
  const width = Math.max(...xs) - left || doc.width;
  const height = Math.max(...depths) - top || doc.height;
  const pad = Math.max(width, height) * MARGIN;

  return {
    rest: spec.rest,
    camera,
    focus: v.focusDistance,
    dof: spec.dof,
    layers,
    box: { left: left - pad, top: top - pad, width: width + 2 * pad, height: height + 2 * pad }
  };
}
