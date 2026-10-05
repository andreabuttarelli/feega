import { Evaluator, type LaneBook, type LaneData } from '../expression/evaluator';
import { ExpressionError, SILENT_AUDIO } from '../expression/language';
import { InputKey, crossLevel, valuesPort, type Crossed, type InputValues, type Level } from '../expression/inputs';
import type { Out } from '../hyperframes/channel-out';
import { apply2d, type Affine } from '../affine';
import { Outside } from './settings';

export type LiveLane = { id: string; key: string; target: string; prop: string; out: Out };

export type Rect = [number, number, number, number];

export type HostStep = { from: number; m: Affine; clip: Rect | null };

export type HostSpec = { steps: HostStep[] };

export type LiveSpec = {
  fps: number;
  duration: number;
  width: number;
  height: number;
  outside: Outside;
  live: LiveLane[];
  lanes: LaneData[];
  order: string[];
  names: Record<string, string>;
  hosts: Record<string, HostSpec>;
  chains: Record<string, string[]>;
};

export type LiveScene = { lanes: LiveLane[]; tick: (global: InputValues, frame: number, dtSeconds: number) => Map<string, number> };


export function laneName(lane: Pick<LiveLane, 'id' | 'key'>): string {
  return `${lane.id}.${lane.key}`;
}

function specBook(spec: LiveSpec): LaneBook {
  const lanes = new Map(spec.lanes.map((l) => [laneName(l), l]));
  return {
    lane: (id, key) => {
      const lane = lanes.get(`${id}.${key}`);
      if (!lane) {
        throw new ExpressionError(`${id} has no live property "${key}"`);
      }
      return lane;
    },
    resolve: (ref) => {
      const id = typeof ref === 'number' ? spec.order[ref - 1] : spec.order.includes(ref) ? ref : spec.names[ref];
      if (!id) {
        throw new ExpressionError(`no layer "${ref}"`);
      }
      return id;
    }
  };
}

function stepAt(host: HostSpec, frame: number): HostStep {
  let step = host.steps[0];
  for (const next of host.steps) {
    if (next.from > frame) {
      break;
    }
    step = next;
  }
  return step;
}

function invert([a, b, c, d, e, f]: Affine): Affine {
  const det = a * d - b * c || Number.EPSILON;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

const POINTER_KEYS: readonly string[] = [InputKey.PointerX, InputKey.PointerY, InputKey.Hover];

const withoutPointer = (values: InputValues): InputValues => Object.fromEntries(Object.entries(values).filter(([k]) => !POINTER_KEYS.includes(k)));

const OUTSIDE: Record<Outside, (crossed: Crossed, held: InputValues | undefined) => InputValues> = {
  [Outside.Fallback]: (crossed) => withoutPointer(crossed.values),
  [Outside.Hold]: (crossed, held) => ({ ...withoutPointer(crossed.values), ...(held ? { [InputKey.PointerX]: held[InputKey.PointerX], [InputKey.PointerY]: held[InputKey.PointerY] } : {}) })
};

export function liveScene(spec: LiveSpec): LiveScene {
  const size = { width: spec.width, height: spec.height };
  const memory = new Map<string, InputValues>();
  const smoothed = new Map<string, number>();
  let global: InputValues = {};
  let dt = 0;

  const levelOf = (host: HostSpec, frame: number): Level => {
    const step = stepAt(host, frame);
    const inverse = invert(step.m);
    const clip = step.clip;
    return {
      toLocal: ([x, y]) => {
        const [lx, ly] = apply2d(inverse, [x * size.width, y * size.height]);
        return [lx / size.width, ly / size.height];
      },
      contains: clip ? ([x, y]) => x * size.width >= clip[0] && x * size.width <= clip[0] + clip[2] && y * size.height >= clip[1] && y * size.height <= clip[1] + clip[3] : undefined
    };
  };

  const localInputs = (id: string, frame: number): InputValues =>
    (spec.chains[id] ?? []).reduce((outer, hostId) => {
        const crossed = crossLevel(outer, levelOf(spec.hosts[hostId], frame));
        if (crossed.inside) {
          memory.set(hostId, crossed.values);
          return crossed.values;
        }
        return OUTSIDE[spec.outside](crossed, memory.get(hostId));
      }, global);

  const smoother = (lane: string) => (slot: number, target: number, seconds: number) => {
    const key = `${lane}#${slot}`;
    const last = smoothed.get(key);
    const next = last === undefined || seconds <= 0 ? target : last + (target - last) * (1 - Math.exp(-dt / seconds));
    smoothed.set(key, next);
    return next;
  };

  const evaluator = new Evaluator(specBook(spec), spec.fps, () => SILENT_AUDIO, (id, key, frame) => valuesPort(localInputs(id, frame), frame / spec.fps, smoother(`${id}.${key}`)));

  return {
    lanes: spec.live,
    tick: (next, frame, dtSeconds) => {
      global = next;
      dt = dtSeconds;
      evaluator.reset();
      const values = new Map<string, number>();
      for (const lane of spec.live) {
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
