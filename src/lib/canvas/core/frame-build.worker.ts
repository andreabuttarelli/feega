import { restoreLocalFiles } from '@feega/motion-core/motion/fonts/local-files';
import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
import { builtAnswer, buildFrame, type BuildAnswer, type BuildAsk } from './frame-build';

self.onmessage = async (e: MessageEvent<BuildAsk>) => {
  const post = (answer: BuildAnswer) => (self as unknown as Worker).postMessage(answer);
  try {
    restoreLocalFiles(e.data.locals);
    post(builtAnswer(e.data.id, await buildFrame(e.data.source, e.data.smoothing, loadFonts)));
  } catch (err) {
    post({ id: e.data.id, error: String(err) });
  }
};
