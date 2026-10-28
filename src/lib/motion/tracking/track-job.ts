import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { trackClip, type LumaReader, type TrackOutcome, type TrackRequest } from '@feega/motion-core/motion/tracking/track-clip';

export type TrackJob = { src: string; doc: MotionDoc; request: TrackRequest };

export type TrackWorker = {
  onmessage: ((event: { data: TrackOutcome }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
  postMessage: (job: TrackJob) => void;
  terminate: () => void;
};

export const handleTrackJob = (job: TrackJob, read: LumaReader): Promise<TrackOutcome> => trackClip(job.doc, job.request, read);

export function runTrackJob(job: TrackJob, spawn: () => TrackWorker | null): Promise<TrackOutcome> {
  const worker = spawn();
  if (!worker) {
    return Promise.resolve({ ok: false, error: 'this browser has no worker support for tracking' });
  }

  return new Promise((resolve) => {
    const done = (outcome: TrackOutcome) => {
      worker.terminate();
      resolve(outcome);
    };
    worker.onmessage = (event) => done(event.data);
    worker.onerror = (event) => done({ ok: false, error: event.message ?? 'tracking failed' });
    worker.postMessage(job);
  });
}
