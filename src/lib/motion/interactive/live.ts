import { clipsOf, type MotionClip, type MotionDoc } from '../doc';
import type { AudioAnalysis } from '../audio-analysis';
import { liveEvaluator } from '../expression/bake';
import { InputKey, crossLevel, readsInput, valuesPort, type Crossed, type InputValues, type Point } from '../expression/inputs';
import { isLiveKey } from '../hyperframes/animate';
import { hostIdsOf } from '../precomp';
import { Outside } from './settings';
import { apply2d, composeLocal, pivotOf, transformAt, type Affine, type Size } from '../parent';

export type LiveLane = { id: string; key: string };

export type LiveScene = { lanes: LiveLane[]; tick: (global: InputValues, frame: number, dtSeconds: number) => Map<string, number> };

const DEG = Math.PI / 180;

export function laneName(lane: LiveLane): string {
  return `${lane.id}.${lane.key}`;
}

export function liveLanes(doc: MotionDoc): LiveLane[] {
  return clipsOf(doc).flatMap((c) =>
    Object.entries(c.expressions)
      .filter(([key, source]) => isLiveKey(key) && readsInput(source))
      .map(([key]) => ({ id: c.id, key }))
  );
}

function projected(host: MotionClip, frame: number, size: Size): Affine {
  const at = (key: Parameters<typeof transformAt>[1]) => transformAt(host, key, frame);
  const pose = {
    x: at('x') * size.width,
    y: at('y') * size.height,
    rotateZ: at('rotateZ'),
    scaleX: at('scale') * at('scaleX') * Math.cos(at('rotateY') * DEG),
    scaleY: at('scale') * at('scaleY') * Math.cos(at('rotateX') * DEG)
  };
  return composeLocal(pose, pivotOf(host, size));
}

function invert([a, b, c, d, e, f]: Affine): Affine {
  const det = a * d - b * c || Number.EPSILON;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

function toLocal(host: MotionClip, frame: number, size: Size): (p: Point) => Point {
  const inverse = invert(projected(host, frame, size));
  return ([x, y]) => {
    const [lx, ly] = apply2d(inverse, [x * size.width, y * size.height]);
    return [lx / size.width, ly / size.height];
  };
}

const POINTER_KEYS = [InputKey.PointerX, InputKey.PointerY, InputKey.Hover] as const;

const withoutPointer = (values: InputValues): InputValues => Object.fromEntries(Object.entries(values).filter(([k]) => !(POINTER_KEYS as readonly string[]).includes(k)));

const OUTSIDE: Record<Outside, (crossed: Crossed, held: InputValues | undefined) => InputValues> = {
  [Outside.Fallback]: (crossed) => withoutPointer(crossed.values),
  [Outside.Hold]: (crossed, held) => ({ ...withoutPointer(crossed.values), ...(held ? { [InputKey.PointerX]: held[InputKey.PointerX], [InputKey.PointerY]: held[InputKey.PointerY] } : {}) })
};

export function liveScene(doc: MotionDoc, analyses: Record<string, AudioAnalysis>, outside: Outside): LiveScene {
  const lanes = liveLanes(doc);
  const size = { width: doc.width, height: doc.height };
  const byId = new Map(clipsOf(doc).map((c) => [c.id, c]));
  const memory = new Map<string, InputValues>();
  const smoothed = new Map<string, number>();
  let global: InputValues = {};
  let dt = 0;

  const localInputs = (id: string, frame: number): InputValues =>
    hostIdsOf(id)
      .flatMap((hostId) => byId.get(hostId) ?? [])
      .reduce((outer, host) => {
        const crossed = crossLevel(outer, toLocal(host, frame, size));
        if (crossed.inside) {
          memory.set(host.id, crossed.values);
          return crossed.values;
        }
        return OUTSIDE[outside](crossed, memory.get(host.id));
      }, global);

  const smoother = (lane: string) => (slot: number, target: number, seconds: number) => {
    const key = `${lane}#${slot}`;
    const last = smoothed.get(key);
    const next = last === undefined || seconds <= 0 ? target : last + (target - last) * (1 - Math.exp(-dt / seconds));
    smoothed.set(key, next);
    return next;
  };

  const evaluator = liveEvaluator(doc, analyses, (id, key, frame) => valuesPort(localInputs(id, frame), frame / doc.fps, smoother(`${id}.${key}`)));

  return {
    lanes,
    tick: (next, frame, dtSeconds) => {
      global = next;
      dt = dtSeconds;
      evaluator.reset();
      const values = new Map<string, number>();
      for (const lane of lanes) {
        try {
          values.set(laneName(lane), evaluator.value(lane.id, lane.key, frame));
        } catch {
          continue;
        }
      }
      return values;
    }
  };
}
