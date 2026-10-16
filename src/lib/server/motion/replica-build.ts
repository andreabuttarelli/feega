import type { Db } from '$lib/server/db/client';
import type { ChatAttachment } from '$lib/chat-attachments';
import { AttachmentKind } from '$lib/chat-attachments';
import { VIDEO_CAPS } from '$lib/server/project-agent/limits';
import { VideoKind, replicaSource } from '$lib/motion/replica';
import { videoSpentUsd } from '$lib/server/repos/video-spend';
import { breakdownReader, videoGrabber } from '$lib/server/video-reference';
import { FramesFailure, motionFrames } from './agent-frames';
import { VERDICT_PROMPT, parseVerdict, runReplicaLoop, type LoopPorts, type SceneReport, type SceneStep } from './replica-loop';

const LIMITED_WAIT_MS = 61_000;

type Scope = { orgId: string; projectId: string; nodeId: string; mode: Parameters<typeof breakdownReader>[1]['mode'] };

export type ReplicaPlan = { referenceId: string };

export function replicaPlan(input: { message: string; attachments: readonly ChatAttachment[]; replicaOf: string | undefined; blank: boolean }): ReplicaPlan | null {
  const video = input.attachments.find((a) => a.kind === AttachmentKind.Video);
  const referenceId = replicaSource({ message: input.message, videoId: video?.assetId, replicaOf: input.replicaOf });
  return referenceId && input.blank ? { referenceId } : null;
}

type DrawnFrame = { time: number; data: string };

async function drawSaved(db: Db, scope: Scope, times: number[]): Promise<{ time: number; bytes: Buffer }[] | null> {
  const ask = () => motionFrames(db, { orgId: scope.orgId, nodeId: scope.nodeId }, { times });
  let drawn = await ask();
  if (!drawn.ok && drawn.failure === FramesFailure.Limited) {
    await new Promise((resolve) => setTimeout(resolve, LIMITED_WAIT_MS));
    drawn = await ask();
  }
  if (!drawn.ok) {
    return null;
  }
  return (drawn.body.frames as DrawnFrame[]).map((f) => ({ time: f.time, bytes: Buffer.from(f.data, 'base64') }));
}

async function judgeScene(scope: Scope, input: Parameters<LoopPorts['judge']>[0]) {
  const [{ llmText, llmVisionModel }, { withOrgContext, withNodeContext }] = await Promise.all([import('$lib/server/llm'), import('$lib/server/ai-log')]);
  const model = llmVisionModel();
  if (!model) {
    return null;
  }
  const images = input.pairs.flatMap((p) => [p.reference, p.ours]).map((b) => ({ mediaType: 'image/jpeg', data: b.toString('base64') }));
  const ask = () => llmText({ prompt: VERDICT_PROMPT(input.scene, input.brief), model, images, label: 'motion.replica-judge' });
  const answer = await withOrgContext(scope.orgId, () => withNodeContext(scope.nodeId, ask)).catch(() => null);
  return answer ? parseVerdict(answer.text) : null;
}

export async function buildReplica(db: Db, scope: Scope, plan: ReplicaPlan, turn: (step: SceneStep) => Promise<void>): Promise<SceneReport[] | null> {
  const breakdown = await breakdownReader(db, scope)(plan.referenceId);
  const grab = await videoGrabber(db, { orgId: scope.orgId, projectId: scope.projectId, assetId: plan.referenceId });
  if (!breakdown.ok || !grab) {
    return null;
  }
  const ports: LoopPorts = {
    grab,
    turn,
    draw: (times) => drawSaved(db, scope, times),
    judge: (input) => judgeScene(scope, input),
    spent: () => videoSpentUsd(db, { orgId: scope.orgId, nodeId: scope.nodeId })
  };
  return runReplicaLoop(breakdown.breakdown, ports, { capUsd: VIDEO_CAPS[VideoKind.Replica].videoUsd });
}

export const reportText = (reports: readonly SceneReport[]) =>
  [
    'Built scene by scene against the reference. Similarity per scene (vision judge, 0–1):',
    ...reports.map((r) => `- scene ${r.scene}: ${r.score === null ? 'not judged' : r.score.toFixed(2)} after ${r.fixes} fix${r.fixes === 1 ? '' : 'es'}, $${r.spentUsd.toFixed(2)}`)
  ].join('\n');
