import sharp from 'sharp';
import type { FrameStat } from '$lib/motion/direction';
import type { Frame } from './frames';

const WHITE_LUMA = 245;

async function statOf(frame: Frame): Promise<FrameStat> {
  const { data } = await sharp(frame.bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let squares = 0;
  let white = 0;
  for (const luma of data) {
    sum += luma;
    squares += luma * luma;
    white += luma >= WHITE_LUMA ? 1 : 0;
  }
  const mean = sum / data.length;
  return { time: frame.time, lumaStd: Math.sqrt(Math.max(0, squares / data.length - mean * mean)), whiteShare: white / data.length };
}

export function frameStats(frames: readonly Frame[]): Promise<FrameStat[]> {
  return Promise.all(frames.map(statOf));
}
