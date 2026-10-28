import { ALL_FORMATS, CanvasSink, Input, UrlSource } from 'mediabunny';
import { lumaOf, type Luma } from '@feega/motion-core/motion/tracking/luma';
import type { LumaReader } from '@feega/motion-core/motion/tracking/track-clip';

const TRACK_WIDTH = 480;
const SEEK_NUDGE_SECONDS = 1e-4;

type Pixels = { getContext(kind: '2d'): { getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> } } | null; width: number; height: number };

async function openSink(src: string, input: Input): Promise<CanvasSink> {
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(await track.canDecode())) {
    throw new Error(`cannot decode ${src}`);
  }
  return new CanvasSink(track, { width: Math.min(TRACK_WIDTH, track.displayWidth) });
}

export const browserLumas =
  (src: string): LumaReader =>
  async (seconds) => {
    const input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS });
    try {
      const sink = await openSink(src, input);
      const lumas: Luma[] = [];

      for (const t of seconds) {
        const wrapped = await sink.getCanvas(t + SEEK_NUDGE_SECONDS);
        const canvas = wrapped?.canvas as Pixels | undefined;
        const pixels = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height);
        if (!canvas || !pixels) {
          throw new Error(`no frame at ${t.toFixed(2)}s`);
        }
        lumas.push(lumaOf(pixels.data, canvas.width, canvas.height));
      }
      return lumas;
    } finally {
      input.dispose();
    }
  };

export async function stillAt(src: string, seconds: number): Promise<ImageBitmap> {
  const input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS });
  try {
    const sink = await openSink(src, input);
    const wrapped = await sink.getCanvas(seconds + SEEK_NUDGE_SECONDS);
    if (!wrapped) {
      throw new Error(`no frame at ${seconds.toFixed(2)}s`);
    }
    return await createImageBitmap(wrapped.canvas);
  } finally {
    input.dispose();
  }
}
