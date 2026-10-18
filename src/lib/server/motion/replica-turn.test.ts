import { describe, expect, it, vi } from 'vitest';
import { AttachmentKind, type ChatAttachment } from '$lib/chat-attachments';
import { MotionFormat } from '$lib/motion/doc';
import { VideoKind } from '$lib/motion/replica';
import { parseBreakdown } from '$lib/video-reference';
import type { BreakdownAnswer } from '$lib/server/video-reference';
import { onceEach, replicaTurn } from './replica-turn';

const video: ChatAttachment = { assetId: 'a-1', kind: AttachmentKind.Video, name: 'kinetic-cautiva.mp4', mimeType: 'video/mp4', bytes: 1 };
const breakdown = parseBreakdown(JSON.stringify({ durationS: 10.1, aspectRatio: '16:9', scenes: [{ start: 0, end: 10.1 }], pacing: { cutsPerMinute: 30, rhythm: 'fast' } }))!;
const read = async (assetId: string): Promise<BreakdownAnswer> => ({ ok: true, assetId, breakdown, brief: 'brief' });
const picture = Buffer.from([1, 2, 3]);
const ports = { read, grabber: async () => async () => picture };

describe('a turn that recreates an attached reference video', () => {
  it('is a replica of it, on the reference canvas, with the reference frames to look at', async () => {
    const turn = await replicaTurn({ message: 'Recreate this video as faithfully as possible', attachments: [video], replicaOf: undefined }, ports);

    expect(turn).toMatchObject({ kind: VideoKind.Replica, replicaOf: 'a-1', canvas: { format: MotionFormat.Landscape, durationS: 10.1 } });
    expect(turn.frames.map((f) => f.time)).toEqual([0.2, 5.1, 9.9]);
  });

  it('a later build turn stays a replica and sees the frames again, without touching the canvas', async () => {
    const turn = await replicaTurn({ message: 'Build it.', attachments: [], replicaOf: 'a-1' }, ports);

    expect(turn).toMatchObject({ kind: VideoKind.Replica, replicaOf: 'a-1', canvas: null });
    expect(turn.frames).toHaveLength(3);
  });

  it('a request without a video is a standard video', async () => {
    expect(await replicaTurn({ message: 'Recreate our hero section', attachments: [], replicaOf: undefined }, ports)).toEqual({ kind: VideoKind.Standard, replicaOf: null, canvas: null, frames: [] });
  });

  it('an unreadable reference keeps the replica budget but has no canvas and no frames', async () => {
    const failed = async (): Promise<BreakdownAnswer> => ({ ok: false, error: 'video_unreadable' as never, message: 'no' });

    expect(await replicaTurn({ message: 'replicate it', attachments: [video], replicaOf: undefined }, { ...ports, read: failed })).toEqual({ kind: VideoKind.Replica, replicaOf: 'a-1', canvas: null, frames: [] });
  });

  it('the breakdown is read once per turn, however many readers ask', async () => {
    const spy = vi.fn(read);
    const once = onceEach(spy);

    await Promise.all([once('a-1'), once('a-1')]);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
