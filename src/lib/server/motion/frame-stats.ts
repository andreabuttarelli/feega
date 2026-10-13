import sharp from 'sharp';
import type { FrameStat } from '$lib/motion/direction';
import type { Frame } from './frames';
import { EMPTY_PROBE_PX, edgeDensity } from '$lib/motion/emptiness';
import { seamDiff } from '$lib/motion/smoothness';

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
  return { time: frame.time, luma: mean, lumaStd: Math.sqrt(Math.max(0, squares / data.length - mean * mean)), whiteShare: white / data.length };
}

export function frameStats(frames: readonly Frame[]): Promise<FrameStat[]> {
  return Promise.all(frames.map(statOf));
}

async function densityOf(frame: Frame): Promise<number> {
  const data = await sharp(frame.bytes).resize(EMPTY_PROBE_PX, EMPTY_PROBE_PX, { fit: 'fill' }).greyscale().raw().toBuffer();
  return edgeDensity(new Uint8Array(data), EMPTY_PROBE_PX, EMPTY_PROBE_PX);
}

export function frameDensities(frames: readonly Frame[]): Promise<number[]> {
  return Promise.all(frames.map(densityOf));
}

const SEAM_PROBE_PX = 64;

const lumaGrid = async (frame: Frame) => new Uint8Array(await sharp(frame.bytes).resize(SEAM_PROBE_PX, SEAM_PROBE_PX, { fit: 'fill' }).greyscale().raw().toBuffer());

export const frameLumas = (frames: readonly Frame[]): Promise<Uint8Array[]> => Promise.all(frames.map(lumaGrid));

export async function seamLuma(frames: readonly Frame[]): Promise<number | null> {
  const first = frames[0];
  const last = frames.at(-1);
  if (!first || !last || frames.length < 2) {
    return null;
  }
  const [a, b] = await Promise.all([lumaGrid(first), lumaGrid(last)]);
  return seamDiff(a, b);
}
