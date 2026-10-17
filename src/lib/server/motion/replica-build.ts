import type { Db } from '$lib/server/db/client';
import type { ChatAttachment } from '$lib/chat-attachments';
import { AttachmentKind } from '$lib/chat-attachments';
import { VIDEO_CAPS } from '$lib/server/project-agent/limits';
import { VideoKind, replicaSource } from '$lib/motion/replica';
import { videoSpentUsd } from '$lib/server/repos/video-spend';
import { breakdownReader, videoGrabber } from '$lib/server/video-reference';
import { FramesFailure, motionFrames } from './agent-frames';
import { runReplicaLoop, type KeptFrame, type LoopPorts, type SceneReport, type SceneStep } from './replica-loop';
import { CANVAS_ASSET_BUCKET } from '$lib/server/repos/asset-storage';

const LIMITED_WAIT_MS = 61_000;
const JPEG = 'image/jpeg';

type Scope = { orgId: string; projectId: string; nodeId: string; runId: string; mode: Parameters<typeof breakdownReader>[1]['mode'] };

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

export const keptPrefix = (scope: Scope) => `${scope.orgId}/${scope.projectId}/replica/${scope.nodeId}/${scope.runId}`;

export const keptPath = (scope: Scope, scene: number, frame: KeptFrame) => `${keptPrefix(scope)}/scene-${scene}/${frame.kind}-r${frame.round}-${frame.time.toFixed(2)}s.jpg`;

async function keepFrames(db: Db, scope: Scope, scene: number, frames: readonly KeptFrame[]): Promise<void> {
  const bucket = db.storage.from(CANVAS_ASSET_BUCKET);
  await Promise.all(frames.map((f) => bucket.upload(keptPath(scope, scene, f), f.bytes, { contentType: JPEG, upsert: true })));
}

export async function buildReplica(db: Db, scope: Scope, plan: ReplicaPlan, turn: (step: SceneStep) => Promise<{ edits: number; budgetSpent: boolean }>): Promise<SceneReport[] | null> {
  const breakdown = await breakdownReader(db, scope)(plan.referenceId);
  const grab = await videoGrabber(db, { orgId: scope.orgId, projectId: scope.projectId, assetId: plan.referenceId });
  if (!breakdown.ok || !grab) {
    return null;
  }
  const ports: LoopPorts = {
    grab,
    turn,
    draw: (times) => drawSaved(db, scope, times),
    keep: (scene, frames) => keepFrames(db, scope, scene, frames),
    spent: () => videoSpentUsd(db, { orgId: scope.orgId, nodeId: scope.nodeId })
  };
  return runReplicaLoop(breakdown.breakdown, ports, { capUsd: VIDEO_CAPS[VideoKind.Replica].videoUsd });
}

export const reportText = (reports: readonly SceneReport[], frames: string) =>
  [
    'Built scene by scene; after each scene the motion agent reviewed its frames next to the reference and fixed them.',
    ...reports.map((r) => `- scene ${r.scene}: ${r.matched ? 'matches' : 'still differs'} after ${r.reviews} review${r.reviews === 1 ? '' : 's'}, pixel similarity ${r.similarity === null ? 'n/a' : r.similarity.toFixed(2)}, $${r.spentUsd.toFixed(2)}`),
    `Reference and replica frames per scene: ${frames}`
  ].join('\n');
