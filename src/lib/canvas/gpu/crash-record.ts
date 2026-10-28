export type Shelf = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type CrashSample = {
  device: string;
  dpr: number;
  resolution: number;
  canvas: string;
  textureBytes: number;
  textures: number;
  texturesCreated: number;
  submits: number;
  gpuLagMs: number;
  cacheBytes: number;
  pictureBytes: number;
  wasmBytes: number;
  zoom: number;
  zoomPerSecond: number;
  panPerSecond: number;
  gestureFrames: number;
  rasterZoom: number;
  at: number;
};

export const SAMPLE_EVERY_MS = 250;

const RECORD_KEY = 'feega:canvas-crash-record';
const OPEN_KEY = 'feega:canvas-open';
const OPEN = '1';

export const blankSample = (): CrashSample => ({ device: '', dpr: 0, resolution: 0, canvas: '', textureBytes: 0, textures: 0, texturesCreated: 0, submits: 0, gpuLagMs: 0, cacheBytes: 0, pictureBytes: 0, wasmBytes: 0, zoom: 0, zoomPerSecond: 0, panPerSecond: 0, gestureFrames: 0, rasterZoom: 0, at: 0 });

export const wasInGesture = (record: CrashSample): boolean => record.gestureFrames > 0;

function quietly<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

export class CrashRecorder {
  private lastWrite = -Infinity;

  constructor(private readonly shelf: Shelf) {}

  begin(): CrashSample | null {
    const crashed = quietly(() => this.shelf.getItem(OPEN_KEY) === OPEN, false);
    const record = crashed ? quietly(() => this.shelf.getItem(RECORD_KEY), null) : null;
    quietly(() => this.shelf.removeItem(RECORD_KEY), undefined);
    this.resume();
    return record ? quietly(() => JSON.parse(record) as CrashSample, null) : null;
  }

  resume(): void {
    quietly(() => this.shelf.setItem(OPEN_KEY, OPEN), undefined);
  }

  sample(sample: CrashSample, now: number): void {
    if (now - this.lastWrite < SAMPLE_EVERY_MS) {
      return;
    }
    this.lastWrite = now;
    quietly(() => this.shelf.setItem(RECORD_KEY, JSON.stringify(sample)), undefined);
  }

  endCleanly(): void {
    quietly(() => this.shelf.removeItem(OPEN_KEY), undefined);
  }
}
