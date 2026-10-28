import { ALL_FORMATS, CanvasSink, Input, UrlSource } from 'mediabunny';
import { createVideoFrames, type Decoder, type VideoFrames } from '@feega/motion-core/motion/gpu-full/video-frames';

const FRAME_BUDGET_BYTES = 1024 * 1024 * 1024;
const DECODER_POOL = 4;
const SEEK_NUDGE_SECONDS = 1e-4;

export const webCodecsReady = () => typeof VideoDecoder !== 'undefined';

async function openDecoder(src: string, width: number): Promise<Decoder> {
  const input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(await track.canDecode())) {
    input.dispose();
    throw new Error(`cannot decode ${src}`);
  }
  const sink = new CanvasSink(track, { width: Math.min(width, track.displayWidth) });
  return {
    frameAt: async (t) => {
      const wrapped = await sink.getCanvas(t + SEEK_NUDGE_SECONDS);
      if (!wrapped) {
        return null;
      }
      const image = await createImageBitmap(wrapped.canvas);
      return { frame: { image, width: image.width, height: image.height }, start: wrapped.timestamp, duration: wrapped.duration };
    },
    close: () => input.dispose()
  };
}

export const createWebCodecsFrames = (budget = FRAME_BUDGET_BYTES): VideoFrames => createVideoFrames({ open: openDecoder, supported: webCodecsReady(), budget, pool: DECODER_POOL });
