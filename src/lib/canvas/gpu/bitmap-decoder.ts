export type DecodeAsk = { id: number; url: string; edge: number };
export type DecodeAnswer = { id: number; bitmap?: ImageBitmap; error?: string };
export type DecodeWorker = { postMessage: (ask: DecodeAsk) => void; onmessage: ((e: MessageEvent<DecodeAnswer>) => void) | null };

type Decode = (url: string, edge: number) => Promise<ImageBitmap>;

type Ports = { spawn: () => DecodeWorker | null; fallback: Decode; base: string };

export function createDecoder({ spawn, fallback, base }: Ports): Decode {
  let worker: DecodeWorker | null | undefined;
  let next = 0;
  const waiting = new Map<number, (answer: DecodeAnswer) => void>();

  const started = () => {
    if (worker === undefined) {
      worker = spawn();
      if (worker) {
        worker.onmessage = (e) => {
          waiting.get(e.data.id)?.(e.data);
          waiting.delete(e.data.id);
        };
      }
    }
    return worker;
  };

  return async (url, edge) => {
    const w = started();
    if (!w) {
      return fallback(url, edge);
    }
    const id = next++;
    const answer = await new Promise<DecodeAnswer>((resolve) => {
      waiting.set(id, resolve);
      w.postMessage({ id, url: new URL(url, base).href, edge });
    });
    return answer.bitmap ?? fallback(url, edge);
  };
}
