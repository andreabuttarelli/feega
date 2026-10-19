import { BACKENDS, type FullBackend } from './backends';
import { drawFrame, type Prepared } from './display-list';
import { createMedia } from './media';
import { readClips, type CustomReads } from './dom/custom';
import type { CoreRaster } from './core-web';

export type FrameSink = (bitmap: ImageBitmap, index: number) => Promise<void>;

const frameAt = (prepared: Prepared, time: number) => Math.round(time * prepared.doc.fps);

const NO_READS: ReadonlySet<string> = new Set();

export const coreExportable = (prepared: Prepared, times: number[], read = NO_READS): boolean => times.every((t) => drawFrame(prepared, frameAt(prepared, t)).unsupported.every((gap) => read.has(gap.clip)));

export async function renderOnCore(prepared: Prepared, backend: FullBackend, times: number[], onFrame: FrameSink, signal: AbortSignal, custom: CustomReads): Promise<boolean> {
  if (!coreExportable(prepared, times, new Set(readClips(prepared.doc).read))) {
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
      const frame = frameAt(prepared, time);
      const read = await custom.readAt(frame);
      const list = drawFrame(prepared, frame, read.reads);
      if (list.unsupported.length) {
        return false;
      }
      await media.ready(list);
      const skipped = raster.draw(list, (item) => read.picture(item) ?? media.pictures(item));
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
