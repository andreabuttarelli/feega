import type { Json } from '$lib/database.types';
import { Gesture, LoadStep, SUMMARY_VERSION } from '$lib/canvas/perf/session-perf';

const HOUR_MS = 60 * 60 * 1000;
export const SUMMARIES_PER_USER_PER_HOUR = 30;
const ID = /^[\w.-]{1,64}$/;
const MAX_TEXT = 200;

enum Field {
  Number = 'number',
  Id = 'id',
  Text = 'text'
}

type Shape = { [key: string]: Field | Shape };

const GESTURE: Shape = { frames: Field.Number, over: Field.Number, p95: Field.Number, p99: Field.Number, longTasks: Field.Number };

const MEMORY: Shape = { textureMb: Field.Number, textures: Field.Number, wasmMb: Field.Number, cacheMb: Field.Number, pictureMb: Field.Number };

const SUMMARY: Shape = {
  v: Field.Number,
  sessionId: Field.Id,
  canvasId: Field.Id,
  device: Field.Id,
  dpr: Field.Number,
  cores: Field.Number,
  memoryGb: Field.Number,
  coreVersion: Field.Id,
  frames: Field.Number,
  nodes: Field.Number,
  docBytes: Field.Number,
  heapMb: Field.Number,
  sessionMs: Field.Number,
  backend: Field.Id,
  fallbacks: Field.Number,
  deviceLost: Field.Number,
  load: Object.fromEntries(Object.values(LoadStep).map((step) => [step, Field.Number])),
  gestures: Object.fromEntries(Object.values(Gesture).map((kind) => [kind, GESTURE])),
  longTasks: { count: Field.Number, ms: Field.Number },
  edit: { n: Field.Number, p50: Field.Number, p95: Field.Number },
  platform: Field.Id,
  reason: Field.Id,
  visible: Field.Number,
  width: Field.Number,
  height: Field.Number,
  diedBefore: Field.Number,
  lastError: Field.Text,
  limits: { maxTexture: Field.Number, maxBuffer: Field.Number },
  memory: MEMORY,
  before: { ...MEMORY, zoom: Field.Number, gestureFrames: Field.Number }
};

const KEEPS: Record<Field, (value: unknown) => boolean> = {
  [Field.Number]: (value) => value === null || (typeof value === 'number' && Number.isFinite(value)),
  [Field.Id]: (value) => value === null || (typeof value === 'string' && ID.test(value)),
  [Field.Text]: (value) => value === null || (typeof value === 'string' && value.length <= MAX_TEXT)
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function fit(value: Record<string, unknown>, shape: Shape): { [key: string]: Json } {
  const kept: { [key: string]: Json } = {};
  for (const [key, rule] of Object.entries(shape)) {
    const field = value[key];
    if (typeof rule === 'string') {
      if (key in value && KEEPS[rule](field)) {
        kept[key] = field as Json;
      }
      continue;
    }
    if (isRecord(field)) {
      kept[key] = fit(field, rule);
    }
  }
  return kept;
}

export type CanvasPerfProps = { [key: string]: Json };

export function perfSummaryOf(body: string): CanvasPerfProps | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== SUMMARY_VERSION) {
    return null;
  }
  return fit(parsed, SUMMARY);
}

export function createPerfGate(clock: () => number = Date.now) {
  let hour = -1;
  let perUser = new Map<string, number>();

  return function admit(userId: string): boolean {
    const now = Math.floor(clock() / HOUR_MS);
    if (now !== hour) {
      hour = now;
      perUser = new Map();
    }

    const mine = perUser.get(userId) ?? 0;
    if (mine >= SUMMARIES_PER_USER_PER_HOUR) {
      return false;
    }
    perUser.set(userId, mine + 1);
    return true;
  };
}
