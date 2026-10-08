import { peakStore, type PeakStore } from './peaks';

const DECODE_RATE = 8000;

let store: PeakStore | null = null;
const pending = new Map<string, Promise<number[]>>();

function browserStore(): PeakStore {
  if (store) {
    return store;
  }
  try {
    store = peakStore(window.localStorage);
  } catch {
    store = peakStore(null);
  }
  return store;
}

async function envelopeOffThread(samples: Float32Array, rate: number): Promise<number[]> {
  const { default: PeaksWorker } = await import('./peaks.worker?worker');
  const worker = new PeaksWorker();
  try {
    return await new Promise<number[]>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<number[]>) => resolve(e.data);
      worker.onerror = () => reject(new Error('peaks_worker_failed'));
      worker.postMessage({ samples, rate }, [samples.buffer]);
    });
  } finally {
    worker.terminate();
  }
}

async function decode(url: string): Promise<number[]> {
  const bytes = await (await fetch(url)).arrayBuffer();
  const audio = await new OfflineAudioContext(1, 1, DECODE_RATE).decodeAudioData(bytes);
  return envelopeOffThread(audio.getChannelData(0).slice(), audio.sampleRate);
}

export function decodePeaks(assetId: string, url: string): Promise<number[]> {
  const known = browserStore().get(assetId);
  if (known) {
    return Promise.resolve(known);
  }

  const inFlight = pending.get(assetId);
  if (inFlight) {
    return inFlight;
  }

  const next = decode(url).then((peaks) => {
    browserStore().put(assetId, peaks);
    return peaks;
  });
  pending.set(assetId, next);
  next.catch(() => pending.delete(assetId));
  return next;
}
