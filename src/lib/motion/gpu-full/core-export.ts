import { BACKENDS, type FullBackend } from './backends';
import { drawFrame, type Prepared } from './display-list';
import { createMedia } from './media';
import type { CoreRaster } from './core-web';

export type FrameSink = (bitmap: ImageBitmap, index: number) => Promise<void>;

const frameAt = (prepared: Prepared, time: number) => Math.round(time * prepared.doc.fps);

export const coreExportable = (prepared: Prepared, times: number[]): boolean => times.every((t) => drawFrame(prepared, frameAt(prepared, t)).unsupported.length === 0);

export async function renderOnCore(prepared: Prepared, backend: FullBackend, times: number[], onFrame: FrameSink, signal: AbortSignal): Promise<boolean> {
  if (!coreExportable(prepared, times)) {
    return false;
  }
  const { width, height } = prepared.doc;
  const canvas = document.createElement('canvas');
  const raster = (await BACKENDS[backend](canvas, width, height).catch(() => null)) as CoreRaster | null;
  if (!raster) {
    return false;
  }
  const media = createMedia();
  try {
    for (const [index, time] of times.entries()) {
      signal.throwIfAborted();
      const list = drawFrame(prepared, frameAt(prepared, time));
      await media.ready(list);
      const skipped = raster.draw(list, media.pictures);
      if (skipped.length) {
        return false;
      }
      await onFrame(await createImageBitmap(canvas), index);
    }
    return true;
  } finally {
    raster.dispose();
    media.dispose();
  }
}
