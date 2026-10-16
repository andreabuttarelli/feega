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

describe('a turn that recreates an attached reference video', () => {
  it('is a replica on the reference canvas', async () => {
    expect(await replicaTurn({ message: 'Recreate this video as faithfully as possible', attachments: [video], stored: undefined, read })).toEqual({ kind: VideoKind.Replica, canvas: { format: MotionFormat.Landscape, durationS: 10.1 } });
  });

  it('a later build turn stays a replica, without touching the canvas', async () => {
    expect(await replicaTurn({ message: 'Build it.', attachments: [], stored: VideoKind.Replica, read })).toEqual({ kind: VideoKind.Replica, canvas: null });
  });

  it('a request without a video is a standard video', async () => {
    expect(await replicaTurn({ message: 'Recreate our hero section', attachments: [], stored: undefined, read })).toEqual({ kind: VideoKind.Standard, canvas: null });
  });

  it('an unreadable reference keeps the replica budget but leaves the canvas alone', async () => {
    const failed = async (): Promise<BreakdownAnswer> => ({ ok: false, error: 'video_unreadable' as never, message: 'no' });

    expect(await replicaTurn({ message: 'replicate it', attachments: [video], stored: undefined, read: failed })).toEqual({ kind: VideoKind.Replica, canvas: null });
  });

  it('the breakdown is read once per turn, however many readers ask', async () => {
    const spy = vi.fn(read);
    const once = onceEach(spy);

    await Promise.all([once('a-1'), once('a-1')]);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
