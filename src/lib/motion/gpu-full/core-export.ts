import { BACKENDS, type FullBackend } from '@feega/motion-core/motion/gpu-full/backends';
import { drawFrame, type Prepared } from '@feega/motion-core/motion/gpu-full/display-list';
import { originalFrames } from '$lib/motion/gpu/shared-frames';
import { createMedia } from '@feega/motion-core/motion/gpu-full/media';
import { readClips, type CustomReads } from '@feega/motion-core/motion/gpu-full/dom/custom';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { CoreRaster } from '@feega/motion-core/motion/gpu-full/core-web';

export type FrameSink = (bitmap: ImageBitmap, index: number) => Promise<void>;

const frameAt = (prepared: Prepared, time: number) => Math.round(time * prepared.doc.fps);

export const snapToFrame = (doc: Pick<MotionDoc, 'fps'>, time: number): number => Math.round(time * doc.fps) / doc.fps;

const NO_READS: ReadonlySet<string> = new Set();

const WHOLE_FRAME_TOLERANCE = 1e-6;

const onWholeFrame = (prepared: Prepared, time: number): boolean => Math.abs(time * prepared.doc.fps - frameAt(prepared, time)) < WHOLE_FRAME_TOLERANCE;

export const coreExportable = (prepared: Prepared, times: number[], read = NO_READS): boolean => times.every((t) => onWholeFrame(prepared, t) && drawFrame(prepared, frameAt(prepared, t)).unsupported.every((gap) => read.has(gap.clip)));

export async function renderOnCore(prepared: Prepared, backend: FullBackend, times: number[], onFrame: FrameSink, signal: AbortSignal, custom: CustomReads): Promise<boolean> {
  if (!coreExportable(prepared, times, new Set(readClips(prepared.doc, prepared.tokens.logoUrl).read))) {
    return false;
  }
  const { width, height } = prepared.doc;
  const canvas = document.createElement('canvas');
  const raster = (await BACKENDS[backend](canvas, width, height).catch(() => null)) as CoreRaster | null;
  if (!raster) {
    return false;
  }
  const media = createMedia({ frames: originalFrames() });
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

export type Size = { width: number; height: number };

export type StillRaster = { shoot: (prepared: Prepared, time: number, size: Size) => Promise<ImageBitmap | null>; dispose: () => void };

export async function stillRaster(backend: FullBackend, side: number): Promise<StillRaster | null> {
  const canvas = document.createElement('canvas');
  const raster = (await BACKENDS[backend](canvas, side, side).catch(() => null)) as CoreRaster | null;
  if (!raster) {
    return null;
  }
  const media = createMedia({ frames: originalFrames() });

  async function shoot(prepared: Prepared, time: number, size: Size): Promise<ImageBitmap | null> {
    if (!coreExportable(prepared, [time])) {
      return null;
    }
    const list = drawFrame(prepared, frameAt(prepared, time));
    await media.ready(list);
    if (raster!.draw(list, media.pictures).length) {
      return null;
    }
    return createImageBitmap(canvas, 0, 0, Math.min(side, size.width), Math.min(side, size.height));
  }

  return {
    shoot,
    dispose: () => {
      raster.dispose();
      media.dispose();
    }
  };
}
