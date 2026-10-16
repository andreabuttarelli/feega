import { sceneLine, type VideoBreakdown } from '$lib/video-reference';
import type { Picture } from '$lib/server/chat-attachments/model-parts';
import { denseTimes, similarity, spreadTimes, type GrabFrame } from './reference-frames';

export const MAX_SCENE_FIXES = 2;
export const REVIEW_PAIRS = 6;

export type SceneSpan = { fromS: number; toS: number };

export type SceneStep = { scene: number; span: SceneSpan; text: string; pictures: Picture[]; capUsd: number; review: boolean };

export type Shot = { time: number; bytes: Buffer };

export type KeptFrame = Shot & { kind: 'reference' | 'ours'; round: number };

export type LoopPorts = {
  grab: GrabFrame;
  turn: (step: SceneStep) => Promise<{ edits: number }>;
  draw: (times: number[]) => Promise<Shot[] | null>;
  spent: () => Promise<number>;
  keep: (scene: number, frames: KeptFrame[]) => Promise<void>;
};

export type SceneReport = { scene: number; reviews: number; matched: boolean; similarity: number | null; spentUsd: number };

type Scene = VideoBreakdown['scenes'][number];

type Pair = { time: number; reference: Buffer; ours: Buffer };

const at = (s: number) => Math.round(s * 100) / 100;
const cents = (usd: number) => Math.round(usd * 100) / 100;

const buildText = (brief: string, scene: number, count: number, span: SceneSpan) =>
  [
    `Scene ${scene} of ${count} of the remake: build ONLY this scene, from ${at(span.fromS)} s to ${at(span.toS)} s on the timeline. Earlier scenes are done and locked; later scenes come in the next steps.`,
    `Reference for this scene: ${brief}`,
    'The pictures that follow are frames of this scene of the reference, in order: copy their layout (positions and sizes as shares of the frame), exact colours, lettering and motion between frames.',
    'When the scene is built, stop: the server then shows you your frames next to the reference.'
  ].join('\n');

const reviewText = (scene: number, span: SceneSpan) =>
  [
    `Scene ${scene} (${at(span.fromS)}–${at(span.toS)} s): the pictures pair each reference frame with your frame at the same time.`,
    'Look at the pairs and fix the differences now; reply only with edits — no explanation. Edit only this scene. If the pairs already match, make no edit.'
  ].join('\n');

const pairPictures = (pairs: readonly Pair[]): Picture[] =>
  pairs.flatMap((p) => [
    { label: `Reference at ${p.time} s:`, bytes: p.reference },
    { label: `Yours at ${p.time} s:`, bytes: p.ours }
  ]);

async function grabAll(grab: GrabFrame, times: readonly number[]): Promise<Shot[]> {
  const grabbed = await Promise.all(times.map(async (time) => ({ time, bytes: await grab(time).catch(() => null) })));
  return grabbed.filter((g): g is Shot => !!g.bytes?.length);
}

async function drawPairs(ports: LoopPorts, references: readonly Shot[]): Promise<Pair[]> {
  const drawn = await ports.draw(references.map((r) => r.time)).catch(() => null);
  const ours = new Map((drawn ?? []).filter((d) => d.bytes.length).map((d) => [d.time, d.bytes]));
  return references.filter((r) => ours.has(r.time)).map((r) => ({ time: r.time, reference: r.bytes, ours: ours.get(r.time)! }));
}

async function meanSimilarity(pairs: readonly Pair[]): Promise<number | null> {
  if (!pairs.length) {
    return null;
  }
  const scores = await Promise.all(pairs.map((p) => similarity(p.reference, p.ours).catch(() => 0)));
  return cents(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

const keptOurs = (pairs: readonly Pair[], round: number): KeptFrame[] => pairs.map((p) => ({ kind: 'ours', round, time: p.time, bytes: p.ours }));

async function runScene(ports: LoopPorts, input: { scene: Scene; index: number; count: number; shareUsd: number }): Promise<SceneReport> {
  const number = input.index + 1;
  const span = { fromS: input.scene.start, toS: input.scene.end };
  const brief = sceneLine(input.scene, input.index).trim();
  const dense = await grabAll(ports.grab, denseTimes(input.scene));
  const reviewAt = new Set(spreadTimes(dense.map((d) => d.time), REVIEW_PAIRS));
  const references = dense.filter((d) => reviewAt.has(d.time));
  await ports.keep(number, dense.map((d) => ({ ...d, kind: 'reference', round: 0 }))).catch(() => undefined);

  const startUsd = await ports.spent();
  const used = async () => (await ports.spent()) - startUsd;

  await ports.turn({ scene: number, span, text: buildText(brief, number, input.count, span), pictures: dense.map((d) => ({ label: `Reference — scene ${number} at ${d.time} s:`, bytes: d.bytes })), capUsd: input.shareUsd, review: false });

  let reviews = 0;
  let matched = false;
  let pairs = await drawPairs(ports, references);
  while (pairs.length && reviews < MAX_SCENE_FIXES && (await used()) < input.shareUsd) {
    await ports.keep(number, keptOurs(pairs, reviews + 1)).catch(() => undefined);
    const { edits } = await ports.turn({ scene: number, span, text: reviewText(number, span), pictures: pairPictures(pairs), capUsd: input.shareUsd - (await used()), review: true });
    reviews += 1;
    if (edits === 0) {
      matched = true;
      break;
    }
    pairs = await drawPairs(ports, references);
  }
  return { scene: number, reviews, matched, similarity: await meanSimilarity(pairs), spentUsd: cents(await used()) };
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
