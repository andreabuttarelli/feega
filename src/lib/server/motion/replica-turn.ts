import { AttachmentKind, type ChatAttachment } from '$lib/chat-attachments';
import { VideoKind, kindOf, replicaFormat, replicaSource, type ReplicaCanvas } from '$lib/motion/replica';
import { breakdownSize, type VideoBreakdown } from '$lib/video-reference';
import type { BreakdownAnswer } from '$lib/server/video-reference';
import { keyTimes, referenceFrames, type GrabFrame, type ReferenceFrame } from './reference-frames';

export type ReplicaTurn = { kind: VideoKind; replicaOf: string | null; canvas: ReplicaCanvas | null; frames: ReferenceFrame[] };

type ReadBreakdown = (assetId: string) => Promise<BreakdownAnswer>;

export type ReplicaPorts = { read: ReadBreakdown; grabber: (assetId: string) => Promise<GrabFrame | null> };

export function onceEach<T>(read: (assetId: string) => Promise<T>): (assetId: string) => Promise<T> {
  const seen = new Map<string, Promise<T>>();
  return (assetId) => {
    const known = seen.get(assetId) ?? read(assetId);
    seen.set(assetId, known);
    return known;
  };
}

function canvasOf(breakdown: VideoBreakdown): ReplicaCanvas | null {
  const size = breakdownSize(breakdown);
  return size ? { format: replicaFormat(size), durationS: breakdown.durationS } : null;
}

const STANDARD: ReplicaTurn = { kind: VideoKind.Standard, replicaOf: null, canvas: null, frames: [] };

export async function replicaTurn(input: { message: string; attachments: readonly ChatAttachment[]; replicaOf: string | undefined }, ports: ReplicaPorts): Promise<ReplicaTurn> {
  const video = input.attachments.find((a) => a.kind === AttachmentKind.Video);
  const replicaOf = replicaSource({ message: input.message, videoId: video?.assetId, replicaOf: input.replicaOf });
  if (!replicaOf) {
    return STANDARD;
  }

  const answer = await ports.read(replicaOf);
  const kind = kindOf(replicaOf);
  if (!answer.ok) {
    return { kind, replicaOf, canvas: null, frames: [] };
  }
  const grab = await ports.grabber(replicaOf);
  const frames = grab ? await referenceFrames(grab, keyTimes(answer.breakdown)) : [];
  const canvas = video?.assetId === replicaOf ? canvasOf(answer.breakdown) : null;
  return { kind, replicaOf, canvas, frames };
}
