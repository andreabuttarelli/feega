import { createFrameCache, type Run } from './frame-cache';

export type Frame = { image: ImageBitmap; width: number; height: number };

export type Decoded = { frame: Frame; start: number; duration: number };

export type Decoder = { frameAt: (t: number) => Promise<Decoded | null>; close: () => void };

type Options = { open: (src: string, width: number) => Promise<Decoder>; supported: boolean; budget: number; pool: number };

export type VideoFrames = { has: (src: string, t: number) => boolean; at: (src: string, t: number, width: number) => Promise<Frame | null>; cached: (src: string) => Run[]; forget: (src: string) => void; bytes: () => number; dispose: () => void };

const BYTES_PER_PIXEL = 4;
const REOPEN_RATIO = 1.5;

type Open = { decoder: Decoder; width: number };

export function createVideoFrames({ open, supported, budget, pool }: Options): VideoFrames {
  const cache = createFrameCache<Frame>({ budget });
  const decoders = new Map<string, Open>();
  const lanes = new Map<string, Promise<unknown>>();
  const failed = new Set<string>();

  const closeOldest = () => {
    while (decoders.size > pool) {
      const [src, entry] = decoders.entries().next().value as [string, Open];
      decoders.delete(src);
      entry.decoder.close();
    }
  };

  const decoderOf = async (src: string, width: number) => {
    const known = decoders.get(src);
    if (known && width <= known.width * REOPEN_RATIO) {
      decoders.delete(src);
      decoders.set(src, known);
      return known.decoder;
    }
    if (known) {
      known.decoder.close();
      cache.clear(src);
    }
    const decoder = await open(src, width);
    decoders.set(src, { decoder, width });
    closeOldest();
    return decoder;
  };

  const resolve = async (src: string, t: number, width: number) => {
    const hit = cache.get(src, t);
    if (hit) {
      return hit;
    }
    try {
      const decoded = await (await decoderOf(src, width)).frameAt(t);
      if (!decoded) {
        return null;
      }
      cache.put(src, decoded.start, decoded.duration, decoded.frame, decoded.frame.width * decoded.frame.height * BYTES_PER_PIXEL);
      return decoded.frame;
    } catch {
      failed.add(src);
      return null;
    }
  };

  const at = (src: string, t: number, width: number): Promise<Frame | null> => {
    if (!supported || failed.has(src)) {
      return Promise.resolve(null);
    }
    const next = (lanes.get(src) ?? Promise.resolve()).then(() => (failed.has(src) ? null : resolve(src, t, width)));
    lanes.set(src, next);
    return next;
  };

  const forget = (src: string) => {
    decoders.get(src)?.decoder.close();
    decoders.delete(src);
    cache.clear(src);
  };

  const dispose = () => {
    decoders.forEach((entry) => entry.decoder.close());
    decoders.clear();
    cache.clear();
  };

  return { has: (src, t) => cache.get(src, t) !== null, at, cached: (src) => cache.runs(src), forget, bytes: cache.bytes, dispose };
}
