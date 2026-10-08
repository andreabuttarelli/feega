import { composeHtml, type ComposeInput } from '$lib/motion/hyperframes/compose';
import type { Frame } from './frames';

export const MAX_FRAME_SIZE = 960;
export const FRAME_QUALITY = 80;

export type Viewport = { width: number; height: number; scale: number };

export type FramePage = {
  load: (html: string) => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  jpeg: (quality: number) => Promise<Buffer>;
  close: () => Promise<void>;
};

export type BrowserPort = { open: (viewport: Viewport) => Promise<FramePage> };

export type FrameAsk = { compose: ComposeInput; times: readonly number[]; size?: number };

function scaleFor(doc: ComposeInput['doc'], size: number): number {
  return Math.min(1, Math.min(size, MAX_FRAME_SIZE) / Math.max(doc.width, doc.height));
}

export async function drawFrames(port: BrowserPort, ask: FrameAsk): Promise<Frame[]> {
  const { doc } = ask.compose;
  const scale = scaleFor(doc, ask.size ?? MAX_FRAME_SIZE);
  const page = await port.open({ width: doc.width, height: doc.height, scale });

  try {
    await page.load(composeHtml(ask.compose));
    const frames: Frame[] = [];
    for (const time of ask.times) {
      await page.seek(time);
      frames.push({ time, bytes: await page.jpeg(FRAME_QUALITY) });
    }
    return frames;
  } finally {
    await page.close();
  }
}

export type FrameSource = () => Promise<Frame[] | null>;

export async function firstFrames(sources: readonly FrameSource[]): Promise<Frame[] | null> {
  for (const source of sources) {
    const frames = await source().catch(() => null);
    if (frames) {
      return frames;
    }
  }
  return null;
}
