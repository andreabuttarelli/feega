import { sceneLine, type VideoBreakdown } from '$lib/video-reference';
import type { Picture } from '$lib/server/chat-attachments/model-parts';
import { denseTimes, judgeTimes, type GrabFrame } from './reference-frames';

export const SCENE_PASS = 0.8;
export const MAX_SCENE_FIXES = 2;
const SCORE_SCALE = 10;

export type SceneSpan = { fromS: number; toS: number };

export type SceneStep = { scene: number; span: SceneSpan; text: string; pictures: Picture[]; capUsd: number };

export type FramePair = { time: number; reference: Buffer; ours: Buffer };

export type Verdict = { score: number; fixes: string[] };

export type LoopPorts = {
  grab: GrabFrame;
  turn: (step: SceneStep) => Promise<void>;
  draw: (times: number[]) => Promise<{ time: number; bytes: Buffer }[] | null>;
  judge: (input: { scene: number; brief: string; pairs: FramePair[] }) => Promise<Verdict | null>;
  spent: () => Promise<number>;
};

export type SceneReport = { scene: number; score: number | null; fixes: number; spentUsd: number };

type Scene = VideoBreakdown['scenes'][number];

const at = (s: number) => Math.round(s * 100) / 100;

const buildText = (brief: string, scene: number, count: number, span: SceneSpan) =>
  [
    `Scene ${scene} of ${count} of the remake: build ONLY this scene, from ${at(span.fromS)} s to ${at(span.toS)} s on the timeline. Earlier scenes are done and locked; later scenes come in the next steps.`,
    `Reference for this scene: ${brief}`,
    'The pictures that follow are frames of this scene of the reference, in order: copy their layout (positions and sizes as shares of the frame), exact colours, lettering and motion between frames.',
    'When the scene is built, stop: the server compares it with the reference and tells you what to fix.'
  ].join('\n');

const fixText = (scene: number, span: SceneSpan, verdict: Verdict) =>
  [
    `A judge compared scene ${scene} (${at(span.fromS)}–${at(span.toS)} s) with the reference and scored it ${Math.round(verdict.score * SCORE_SCALE)}/10. Fix it, worst first, editing only this scene:`,
    ...verdict.fixes.map((f) => `- ${f}`),
    'The pictures that follow pair each reference frame with your frame at the same time.'
  ].join('\n');

const refPicture = (scene: number) => (time: number, bytes: Buffer): Picture => ({ label: `Reference — scene ${scene} at ${time} s:`, bytes });

const pairPictures = (pairs: readonly FramePair[]): Picture[] => pairs.flatMap((p) => [
  { label: `Reference at ${p.time} s:`, bytes: p.reference },
  { label: `Your frame at ${p.time} s:`, bytes: p.ours }
]);

async function grabAll(grab: GrabFrame, times: readonly number[]): Promise<{ time: number; bytes: Buffer }[]> {
  const grabbed = await Promise.all(times.map(async (time) => ({ time, bytes: await grab(time).catch(() => null) })));
  return grabbed.filter((g): g is { time: number; bytes: Buffer } => !!g.bytes?.length);
}

async function judged(ports: LoopPorts, scene: number, brief: string, references: readonly { time: number; bytes: Buffer }[]): Promise<{ verdict: Verdict | null; pairs: FramePair[] }> {
  const drawn = await ports.draw(references.map((r) => r.time)).catch(() => null);
  if (!drawn) {
    return { verdict: null, pairs: [] };
  }
  const ours = new Map(drawn.filter((d) => d.bytes.length).map((d) => [d.time, d.bytes]));
  const pairs = references.filter((r) => ours.has(r.time)).map((r) => ({ time: r.time, reference: r.bytes, ours: ours.get(r.time)! }));
  return { verdict: pairs.length ? await ports.judge({ scene, brief, pairs }).catch(() => null) : null, pairs };
}

async function runScene(ports: LoopPorts, input: { scene: Scene; index: number; count: number; shareUsd: number }): Promise<SceneReport> {
  const number = input.index + 1;
  const span = { fromS: input.scene.start, toS: input.scene.end };
  const brief = sceneLine(input.scene, input.index).trim();
  const dense = await grabAll(ports.grab, denseTimes(input.scene));
  const judgeAt = new Set(judgeTimes(dense.map((d) => d.time)));
  const references = dense.filter((d) => judgeAt.has(d.time));
  const startUsd = await ports.spent();
  const used = async () => (await ports.spent()) - startUsd;

  await ports.turn({ scene: number, span, text: buildText(brief, number, input.count, span), pictures: dense.map((d) => refPicture(number)(d.time, d.bytes)), capUsd: input.shareUsd });
  let round = await judged(ports, number, brief, references);
  let fixes = 0;
  while (round.verdict && round.verdict.score < SCENE_PASS && fixes < MAX_SCENE_FIXES && (await used()) < input.shareUsd) {
    await ports.turn({ scene: number, span, text: fixText(number, span, round.verdict), pictures: pairPictures(round.pairs), capUsd: input.shareUsd - (await used()) });
    fixes += 1;
    round = await judged(ports, number, brief, references);
  }
  return { scene: number, score: round.verdict?.score ?? null, fixes, spentUsd: Math.round((await used()) * 100) / 100 };
}

export async function runReplicaLoop(breakdown: Pick<VideoBreakdown, 'scenes'>, ports: LoopPorts, budget: { capUsd: number }): Promise<SceneReport[]> {
  const count = breakdown.scenes.length;
  const shareUsd = budget.capUsd / count;
  const reports: SceneReport[] = [];
  for (const [index, scene] of breakdown.scenes.entries()) {
    reports.push(await runScene(ports, { scene, index, count, shareUsd }));
  }
  return reports;
}

export const VERDICT_PROMPT = (scene: number, brief: string) =>
  [
    `You judge how faithfully scene ${scene} of a video remake copies its reference. Scene: ${brief}`,
    'The images come in pairs at the same time: first the reference, then the remake.',
    'Score 0–10 how close the remake looks: layout and positions, sizes, colours and gradients, typography (family, weight, case, scale), and the motion state at each time. 10 is indistinguishable, 5 is the same idea drawn differently, 0 is unrelated.',
    'Answer ONLY with JSON: {"score": number, "fixes": [string]} — up to 5 concrete fixes, worst first, each naming what to change and to what (e.g. "the title is 30% of the frame width, the reference fills 90%: scale it up").'
  ].join('\n');

const FENCE = /^```(?:json)?\s*|\s*```$/g;

export function parseVerdict(raw: string): Verdict | null {
  try {
    const json = JSON.parse(raw.trim().replace(FENCE, '')) as { score?: unknown; fixes?: unknown };
    if (typeof json.score !== 'number') {
      return null;
    }
    const fixes = Array.isArray(json.fixes) ? json.fixes.filter((f): f is string => typeof f === 'string') : [];
    return { score: Math.max(0, Math.min(SCORE_SCALE, json.score)) / SCORE_SCALE, fixes };
  } catch {
    return null;
  }
}
