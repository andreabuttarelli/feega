const KEY_PREFIX = 'motion-peaks:v1:';
const STORED_DECIMALS = 100;

export function peakEnvelope(samples: Float32Array, rate: number, perSecond: number): number[] {
  const size = rate / perSecond;
  const count = Math.ceil(samples.length / size);
  const peaks = Array.from({ length: count }, (_, b) => {
    let peak = 0;
    const end = Math.min(samples.length, Math.round((b + 1) * size));
    for (let i = Math.round(b * size); i < end; i++) {
      peak = Math.max(peak, Math.abs(samples[i]));
    }
    return peak;
  });

  const loudest = Math.max(0, ...peaks);
  return peaks.map((p) => (loudest > 0 ? Math.round((p / loudest) * 1000) / 1000 : 0));
}

type PeakStorage = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };

export type PeakStore = { get: (assetId: string) => number[] | null; put: (assetId: string, peaks: number[]) => void };

function readStored(storage: PeakStorage | null, assetId: string): number[] | null {
  try {
    const raw = storage?.getItem(KEY_PREFIX + assetId);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as number[]) : null;
  } catch {
    return null;
  }
}

function writeStored(storage: PeakStorage | null, assetId: string, peaks: number[]) {
  try {
    storage?.setItem(KEY_PREFIX + assetId, JSON.stringify(peaks.map((p) => Math.round(p * STORED_DECIMALS) / STORED_DECIMALS)));
  } catch {
    return;
  }
}

export function peakStore(storage: PeakStorage | null): PeakStore {
  const memory = new Map<string, number[]>();

  return {
    get(assetId) {
      const known = memory.get(assetId) ?? readStored(storage, assetId);
      if (known) {
        memory.set(assetId, known);
      }
      return known ?? null;
    },
    put(assetId, peaks) {
      memory.set(assetId, peaks);
      writeStored(storage, assetId, peaks);
    }
  };
}
