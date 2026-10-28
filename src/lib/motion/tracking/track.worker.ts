import { browserLumas } from './browser-lumas';
import { handleTrackJob, type TrackJob } from './track-job';

self.onmessage = async (event: MessageEvent<TrackJob>) => {
  const outcome = await handleTrackJob(event.data, browserLumas(event.data.src)).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
  self.postMessage(outcome);
};
