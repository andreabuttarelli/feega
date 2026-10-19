import { describe, expect, it, vi } from 'vitest';
import { createDecoder, type DecodeAnswer, type DecodeAsk, type DecodeWorker } from './bitmap-decoder';

function fakeWorker(answer: (ask: DecodeAsk) => Omit<DecodeAnswer, 'id'>): DecodeWorker & { asked: DecodeAsk[] } {
  const asked: DecodeAsk[] = [];
  const w = {
    asked,
    onmessage: null as ((e: MessageEvent<DecodeAnswer>) => void) | null,
    postMessage(ask: DecodeAsk) {
      asked.push(ask);
      queueMicrotask(() => w.onmessage?.({ data: { id: ask.id, ...answer(ask) } } as MessageEvent<DecodeAnswer>));
    }
  };
  return w;
}

const BITMAP = { width: 512, height: 288 } as ImageBitmap;

describe('decoding a texture off the main thread', () => {
  it('asks the worker with the absolute url and the decode edge, and returns its bitmap', async () => {
    const worker = fakeWorker(() => ({ bitmap: BITMAP }));
    const fallback = vi.fn();
    const decode = createDecoder({ spawn: () => worker, fallback, base: 'https://feega.app/p/x/c/y' });

    expect(await decode('/p/x/c/y/assets/a1?size=256', 512)).toBe(BITMAP);
    expect(worker.asked[0]).toMatchObject({ url: 'https://feega.app/p/x/c/y/assets/a1?size=256', edge: 512 });
    expect(fallback).not.toHaveBeenCalled();
  });

  it('decodes on the main thread where no worker can start', async () => {
    const fallback = vi.fn(async () => BITMAP);
    const decode = createDecoder({ spawn: () => null, fallback, base: 'https://feega.app/' });

    expect(await decode('/a.png', 512)).toBe(BITMAP);
    expect(fallback).toHaveBeenCalledWith('/a.png', 512);
  });

  it('decodes on the main thread when the worker could not', async () => {
    const fallback = vi.fn(async () => BITMAP);
    const decode = createDecoder({ spawn: () => fakeWorker(() => ({ error: 'createImageBitmap unsupported' })), fallback, base: 'https://feega.app/' });

    expect(await decode('/a.png', 512)).toBe(BITMAP);
  });
});
