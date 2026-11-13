import { restoreLocalFiles } from '@feega/motion-core/motion/fonts/local-files';
import { loadFonts } from '@feega/motion-core/motion/gpu-full/text/load';
import { builtAnswer, playingBuilder, shotAnswer, shotAway, transfers, type BuildAnswer, type BuildAsk } from './frame-build';

const build = playingBuilder(loadFonts);

self.onmessage = async (e: MessageEvent<BuildAsk>) => {
  const post = (answer: BuildAnswer) => (self as unknown as Worker).postMessage(answer, transfers(answer));
  try {
    restoreLocalFiles(e.data.locals);
    post(e.data.shot ? shotAnswer(e.data.id, await shotAway(e.data.shot, e.data.smoothing, loadFonts)) : builtAnswer(e.data.id, await build(e.data)));
  } catch (err) {
    post({ id: e.data.id, error: String(err) });
  }
};
