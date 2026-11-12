export enum Gesture {
  Pan = 'pan',
  Zoom = 'zoom',
  Fit = 'fit',
  Drag = 'drag'
}

export enum LoadStep {
  FirstContent = 'firstContent',
  AllFrames = 'allFrames',
  Sharp = 'sharp'
}

export enum Camera {
  Still = 'still',
  Panning = 'panning',
  Zooming = 'zooming'
}

export const SUMMARY_VERSION = 1;
export const FRAME_BUDGET_MS = 1000 / 90;
const HIDDEN_GAP_MS = 1000;
const FRAME_BUCKET_MS = 1;
const FRAME_CEILING_MS = 250;
const EDIT_BUCKET_MS = 10;
const EDIT_CEILING_MS = 5000;
const P50 = 0.5;
const P95 = 0.95;
const P99 = 0.99;

export class Histogram {
  private readonly counts: Uint32Array;
  count = 0;

  constructor(
    private readonly width: number,
    ceiling: number
  ) {
    this.counts = new Uint32Array(Math.ceil(ceiling / width) + 1);
  }

  add(value: number) {
    this.counts[Math.min(Math.ceil(value / this.width), this.counts.length - 1)]++;
    this.count++;
  }

  quantile(q: number): number | null {
    if (!this.count) {
      return null;
    }

    const rank = Math.ceil(q * this.count);
    let seen = 0;
    for (let i = 0; i < this.counts.length; i++) {
      seen += this.counts[i];
      if (seen >= rank) {
        return i * this.width;
      }
    }
    return (this.counts.length - 1) * this.width;
  }
}

type GestureStats = { times: Histogram; over: number; longTasks: number };

export type GestureSummary = { frames: number; over: number; p95: number | null; p99: number | null; longTasks: number };

export type Context = { sessionId: string; canvasId: string; device: string; dpr: number; cores: number; memoryGb: number | null; coreVersion: string; frames: number; nodes: number; docBytes: number; heapMb: number | null };

export type PerfSummary = Context & {
  v: number;
  sessionMs: number;
  backend: string | null;
  fallbacks: number;
  deviceLost: number;
  load: Record<LoadStep, number | null>;
  gestures: Partial<Record<Gesture, GestureSummary>>;
  longTasks: { count: number; ms: number };
  edit: { n: number; p50: number | null; p95: number | null };
};

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 1000 : 0);

export function sessionPerf(startedAt = 0) {
  const gestures = new Map<Gesture, GestureStats>();
  const edits = new Histogram(EDIT_BUCKET_MS, EDIT_CEILING_MS);
  const load: Record<LoadStep, number | null> = { [LoadStep.FirstContent]: null, [LoadStep.AllFrames]: null, [LoadStep.Sharp]: null };
  const longTasks = { count: 0, ms: 0 };
  let current: Gesture | null = null;
  let lastAt = -Infinity;
  let backend: string | null = null;
  let fallbacks = 0;
  let deviceLost = 0;

  const statsOf = (kind: Gesture) => gestures.get(kind) ?? gestures.set(kind, { times: new Histogram(FRAME_BUCKET_MS, FRAME_CEILING_MS), over: 0, longTasks: 0 }).get(kind)!;

  return {
    frame(kind: Gesture | null, at: number) {
      const delta = at - lastAt;
      const continues = kind !== null && kind === current && delta <= HIDDEN_GAP_MS;
      current = kind;
      lastAt = at;
      if (!continues || kind === null) {
        return;
      }

      const stats = statsOf(kind);
      stats.times.add(delta);
      if (delta > FRAME_BUDGET_MS) {
        stats.over++;
      }
    },

    longTask(ms: number) {
      longTasks.count++;
      longTasks.ms += Math.round(ms);
      if (current) {
        statsOf(current).longTasks++;
      }
    },

    edit(ms: number) {
      edits.add(ms);
    },

    backend(name: string) {
      if (backend !== null && backend !== name) {
        fallbacks++;
      }
      backend = name;
    },

    deviceLost() {
      deviceLost++;
    },

    load(step: LoadStep, at: number) {
      load[step] ??= Math.round(at);
    },

    summary(context: Context, now: number): PerfSummary {
      const gestureSummaries = Object.fromEntries(
        [...gestures].filter(([, s]) => s.times.count || s.longTasks).map(([kind, s]) => [kind, { frames: s.times.count, over: share(s.over, s.times.count), p95: s.times.quantile(P95), p99: s.times.quantile(P99), longTasks: s.longTasks }])
      );
      return {
        v: SUMMARY_VERSION,
        ...context,
        sessionMs: Math.round(now - startedAt),
        backend,
        fallbacks,
        deviceLost,
        load: { ...load },
        gestures: gestureSummaries,
        longTasks: { ...longTasks },
        edit: { n: edits.count, p50: edits.quantile(P50), p95: edits.quantile(P95) }
      };
    }
  };
}

export type Moment = { lifting: boolean; camera: Camera; fitting: boolean };

const CAMERA_GESTURE: Record<Camera, Gesture | null> = { [Camera.Still]: null, [Camera.Panning]: Gesture.Pan, [Camera.Zooming]: Gesture.Zoom };

export function gestureOf({ lifting, camera, fitting }: Moment): Gesture | null {
  if (lifting) {
    return Gesture.Drag;
  }
  if (fitting && camera !== Camera.Still) {
    return Gesture.Fit;
  }
  return CAMERA_GESTURE[camera];
}

export type SessionPerf = ReturnType<typeof sessionPerf>;
