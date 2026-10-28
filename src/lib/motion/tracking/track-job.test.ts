import { describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { movingSquare } from '@feega/motion-core/motion/tracking/scene';
import { handleTrackJob, runTrackJob, type TrackJob, type TrackWorker } from './track-job';

const W = 160;
const H = 90;

function job(): TrackJob {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Video', from: 0, durationInFrames: 20 }, 'v1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return { src: 'blob:video', doc: added.doc, request: { clipId: 'v1', frame: 0, point: { x: (20 + 12) / W, y: (20 + 12) / H }, range: { from: 0, to: 10 } } };
}

const reader = async (seconds: number[]) => seconds.map((s) => movingSquare(W, H, 20 + Math.round(s * 30) * 2, 20));

function fakeWorker(reply: (job: TrackJob) => unknown, mode: 'message' | 'error' = 'message') {
  const worker: TrackWorker & { terminate: ReturnType<typeof vi.fn> } = {
    onmessage: null,
    onerror: null,
    terminate: vi.fn(),
    postMessage(sent: TrackJob) {
      queueMicrotask(() => (mode === 'message' ? worker.onmessage?.({ data: reply(sent) }) : worker.onerror?.({ message: 'boom' })));
    }
  };
  return worker;
}

describe('track job', () => {
  it('runs the tracker on the decoded frames and returns the track', async () => {
    const out = await handleTrackJob(job(), reader);

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.track.points).toHaveLength(11);
    }
  });

  it('hands the job to a worker, returns its answer and shuts it down', async () => {
    const worker = fakeWorker(() => ({ ok: true, track: { clipId: 'v1', anchor: 0, lost: false, points: [] } }));

    const out = await runTrackJob(job(), () => worker);

    expect(out).toMatchObject({ ok: true });
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('turns a worker crash into an error the panel can show', async () => {
    const worker = fakeWorker(() => null, 'error');

    expect(await runTrackJob(job(), () => worker)).toEqual({ ok: false, error: 'boom' });
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('says so when the browser has no workers', async () => {
    expect(await runTrackJob(job(), () => null)).toMatchObject({ ok: false, error: expect.stringContaining('worker') });
  });
});
