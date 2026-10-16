import { AttachmentKind, type ChatAttachment } from '$lib/chat-attachments';
import { VideoKind, replicaFormat, videoKindOf, type ReplicaCanvas } from '$lib/motion/replica';
import { breakdownSize } from '$lib/video-reference';
import type { BreakdownAnswer } from '$lib/server/video-reference';

export type ReplicaTurn = { kind: VideoKind; canvas: ReplicaCanvas | null };

type ReadBreakdown = (assetId: string) => Promise<BreakdownAnswer>;

export function onceEach(read: ReadBreakdown): ReadBreakdown {
  const seen = new Map<string, Promise<BreakdownAnswer>>();
  return (assetId) => {
    const known = seen.get(assetId) ?? read(assetId);
    seen.set(assetId, known);
    return known;
  };
}

async function referenceCanvas(video: ChatAttachment, read: ReadBreakdown): Promise<ReplicaCanvas | null> {
  const answer = await read(video.assetId);
  const size = answer.ok ? breakdownSize(answer.breakdown) : null;
  return answer.ok && size ? { format: replicaFormat(size), durationS: answer.breakdown.durationS } : null;
}

export async function replicaTurn(input: { message: string; attachments: readonly ChatAttachment[]; stored: VideoKind | undefined; read: ReadBreakdown }): Promise<ReplicaTurn> {
  const video = input.attachments.find((a) => a.kind === AttachmentKind.Video);
  const kind = videoKindOf({ message: input.message, videoAttached: !!video, stored: input.stored });
  if (kind !== VideoKind.Replica || !video) {
    return { kind, canvas: null };
  }
  return { kind, canvas: await referenceCanvas(video, input.read) };
}
