import type { DecodeAnswer, DecodeAsk } from './bitmap-decoder';
import { decodeHere } from './decode-here';

self.onmessage = async (e: MessageEvent<DecodeAsk>) => {
  const post = (answer: DecodeAnswer, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(answer, transfer);
  try {
    const bitmap = await decodeHere(e.data.url, e.data.edge);
    post({ id: e.data.id, bitmap }, [bitmap]);
  } catch (err) {
    post({ id: e.data.id, error: String(err) });
  }
};
