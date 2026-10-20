import { createDecoder, type DecodeWorker } from './bitmap-decoder';
import { decodeHere } from './decode-here';

function spawn(): DecodeWorker | null {
  try {
    return new Worker(new URL('./bitmap-decode.worker.ts', import.meta.url), { type: 'module' }) as unknown as DecodeWorker;
  } catch {
    return null;
  }
}

export const textureDecoder = createDecoder({ spawn, fallback: decodeHere, base: typeof location === 'undefined' ? 'http://localhost/' : location.href });
