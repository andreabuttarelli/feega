import { decodeTile, encodeTile, type CodecAnswer, type CodecAsk } from './tile-codec';

self.onmessage = async (e: MessageEvent<CodecAsk>) => {
  const started = performance.now();
  const post = (answer: CodecAnswer, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(answer, transfer);
  try {
    if ('encode' in e.data) {
      post({ id: e.data.id, blob: await encodeTile(e.data.encode, e.data.type), ms: performance.now() - started });
      return;
    }
    const pixels = await decodeTile(e.data.decode);
    post({ id: e.data.id, pixels, ms: performance.now() - started }, [pixels.buffer]);
  } catch (err) {
    post({ id: e.data.id, ms: performance.now() - started, error: String(err) });
  }
};
