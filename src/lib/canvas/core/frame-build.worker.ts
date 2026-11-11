import { restoreLocalFiles } from '@feega/motion-core/motion/fonts/local-files';
import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
import { builtAnswer, playingBuilder, transfers, type BuildAnswer, type BuildAsk } from './frame-build';

const build = playingBuilder(loadFonts);

self.onmessage = async (e: MessageEvent<BuildAsk>) => {
  const post = (answer: BuildAnswer) => (self as unknown as Worker).postMessage(answer, transfers(answer));
  try {
    restoreLocalFiles(e.data.locals);
    post(builtAnswer(e.data.id, await build(e.data)));
  } catch (err) {
    post({ id: e.data.id, error: String(err) });
  }
};
