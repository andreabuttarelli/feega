import { restoreLocalFiles } from '@feega/motion-core/motion/fonts/local-files';
import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
import { buildFrame, type BuildAnswer, type BuildAsk, type FrameDoc } from './frame-build';

self.onmessage = async (e: MessageEvent<BuildAsk>) => {
  const post = (answer: BuildAnswer) => (self as unknown as Worker).postMessage(answer);
  try {
    restoreLocalFiles(e.data.locals);
    const res = await fetch(e.data.url);
    if (!res.ok) {
      post({ id: e.data.id, error: `${res.status} ${e.data.url}` });
      return;
    }
    const source = (await res.json()) as FrameDoc;
    post({ id: e.data.id, list: await buildFrame(source, e.data.smoothing, loadFonts) });
  } catch (err) {
    post({ id: e.data.id, error: String(err) });
  }
};
