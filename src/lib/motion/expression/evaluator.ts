import type { Keyframe } from '../keyframes';
import { sampleTrack } from '../sample-track';
import { ExpressionError, compileExpression, runExpression, type AudioPort, type LayerHandle, type Program } from './language';
import { fallbackPort, type InputPort } from './inputs';

export type InputSource = (clipId: string, key: string, frame: number) => InputPort;

export type Range = { min: number; max: number; step: number };

export type LaneData = { id: string; key: string; range: Range; from: number; track: readonly Keyframe[]; base: number; source?: string; index: number };

export type LaneBook = { lane: (id: string, key: string) => LaneData; resolve: (ref: string | number) => string };

const MIN_TOLERANCE = 1e-4;
const TOLERANCE_PER_STEP = 0.01;

function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return h | 0;
}

const clamp = (v: number, range: Range) => Math.min(range.max, Math.max(range.min, v));

const keyedAt = (lane: LaneData, local: number) => (lane.track.length ? sampleTrack(lane.track as Keyframe[], local) : lane.base);

export class Evaluator {
  private readonly programs = new Map<string, Program>();
  private readonly memo = new Map<string, number>();
  private readonly visiting: string[] = [];

  constructor(
    private readonly book: LaneBook,
    private readonly fps: number,
    private readonly audio: (frame: number) => AudioPort,
    private readonly inputs: InputSource = (_id, _key, frame) => fallbackPort(frame / fps)
  ) {}

  value(id: string, key: string, frame: number): number {
    const lane = this.book.lane(id, key);
    const local = frame - lane.from;
    const keyed = keyedAt(lane, local);
    if (!lane.source) {
      return keyed;
    }

    const name = `${id}.${key}`;
    const memoKey = `${name}@${frame}`;
    const known = this.memo.get(memoKey);
    if (known !== undefined) {
      return known;
    }
    const loop = this.visiting.indexOf(name);
    if (loop >= 0) {
      throw new ExpressionError(`expression cycle: ${[...this.visiting.slice(loop), name].join(' → ')}`);
    }

    this.visiting.push(name);
    try {
      const result = runExpression(this.program(name, lane.source), {
        time: local / this.fps,
        frame: local,
        fps: this.fps,
        value: keyed,
        index: lane.index,
        seed: seedOf(name),
        track: lane.track,
        thisLayer: this.handle(id, frame),
        layer: (ref) => this.handle(this.book.resolve(ref), frame),
        audio: this.audio(frame),
        input: this.inputs(id, key, frame)
      });
      const clamped = clamp(result, lane.range);
      this.memo.set(memoKey, clamped);
      return clamped;
    } finally {
      this.visiting.pop();
    }
  }

  reset(): void {
    this.memo.clear();
  }

  tolerance(id: string, key: string): number {
    return Math.max(MIN_TOLERANCE, this.book.lane(id, key).range.step * TOLERANCE_PER_STEP);
  }

  private program(name: string, source: string): Program {
    const cached = this.programs.get(name);
    if (cached) {
      return cached;
    }
    const compiled = compileExpression(source);
    if (!compiled.ok) {
      throw new ExpressionError(compiled.error);
    }
    this.programs.set(name, compiled.program);
    return compiled.program;
  }

  private handle(id: string, frame: number): LayerHandle {
    return { get: (key) => this.value(id, key, frame) };
  }
}
