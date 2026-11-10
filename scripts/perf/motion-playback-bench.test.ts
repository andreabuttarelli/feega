import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "vitest";
import {
  drawFrame,
  prepare,
} from "@feega/motion-core/motion/gpu-full/display-list";
import type { MotionDoc } from "@feega/motion-core/motion/doc";
import { FEEGA_TOKENS } from "@feega/motion-core/motion/brand";
import { liveGenerations } from "../../src/lib/canvas/core/live-generations";

const FIXTURE = process.env.BENCH_MOTION_CANVAS ?? "";
const SAMPLES = 12;
const VSYNC_MS = 1000 / 60;
const PLAY_MS = 5000;
const LANES = 3;
const MS_PER_S = 1000;
const TOKENS = FEEGA_TOKENS;

enum Landing {
  LatestOnly = "latest only",
  NewerThanShown = "newer than shown",
}

type Heads = Record<string, { doc: MotionDoc }>;
type Run = { fps: number; driftMs: number; driftP95: number };

const time = (work: () => void) => {
  const started = performance.now();
  work();
  return performance.now() - started;
};

function measure(text: string, doc: MotionDoc) {
  const frames = Array.from({ length: SAMPLES }, (_, i) =>
    Math.floor((i * doc.durationInFrames) / SAMPLES),
  );
  const cold = frames.map((f) =>
    time(() => drawFrame(prepare(JSON.parse(text) as MotionDoc, TOKENS), f)),
  );
  const prepared = prepare(doc, TOKENS);
  const warm = frames.map((f) => time(() => drawFrame(prepared, f)));
  return { cold, warm };
}

function play(fps: number, builds: number[], landing: Landing): Run {
  const gens = liveGenerations();
  const lanes = Array<number>(LANES).fill(0);
  const pending: { at: number; generation: number; frame: number }[] = [];
  let latest = 0;
  let shown = 0;
  let landed = 0;
  const drift: number[] = [];

  for (let now = 0, i = 0; now < PLAY_MS; now += VSYNC_MS, i++) {
    for (const done of pending
      .filter((p) => p.at <= now)
      .sort((a, b) => a.at - b.at)) {
      pending.splice(pending.indexOf(done), 1);
      const lands =
        landing === Landing.LatestOnly
          ? done.generation === latest
          : gens.land("f", done.generation);
      if (lands && done.frame !== shown) {
        shown = done.frame;
        landed++;
      }
    }
    const frame = Math.floor((now * fps) / MS_PER_S);
    drift.push(((frame - shown) * MS_PER_S) / fps);
    latest = gens.ask("f");
    const lane = lanes.indexOf(Math.min(...lanes));
    lanes[lane] = Math.max(lanes[lane], now) + builds[i % builds.length];
    pending.push({ at: lanes[lane], generation: latest, frame });
  }

  const sorted = [...drift].sort((a, b) => a - b);
  return {
    fps: (landed * MS_PER_S) / PLAY_MS,
    driftMs: drift.reduce((a, b) => a + b, 0) / drift.length,
    driftP95: sorted[Math.floor(sorted.length * 0.95)],
  };
}

const fmt = (r: Run) =>
  `${r.fps.toFixed(1)} fps, drift mean ${r.driftMs.toFixed(0)} ms p95 ${r.driftP95.toFixed(0)} ms`;

describe.skipIf(!existsSync(FIXTURE))(
  "motion playback on a heavy canvas",
  () => {
    it("reports presented fps and timeline drift per playing frame", () => {
      const heads = JSON.parse(readFileSync(FIXTURE, "utf8")).heads as Heads;
      for (const [id, { doc }] of Object.entries(heads)) {
        const text = JSON.stringify(doc);
        const { cold, warm } = measure(text, doc);
        const median = (xs: number[]) =>
          [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
        console.log(
          `${id.slice(0, 8)} ${(text.length / 1e6).toFixed(1)}MB build ${median(cold).toFixed(1)}→${median(warm).toFixed(1)} ms | before: ${fmt(play(doc.fps, cold, Landing.LatestOnly))} | after: ${fmt(play(doc.fps, warm, Landing.NewerThanShown))}`,
        );
      }
    });
  },
);
