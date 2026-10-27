import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Luma } from '@feega/motion-core/motion/tracking/luma';
import type { LumaReader } from '@feega/motion-core/motion/tracking/track-clip';
import { ensureFfmpegPath } from '$lib/server/ffmpeg-bin';

const run = promisify(execFile);

const TRACK_WIDTH = 480;
const SIZE_IN_LOG = /Stream #.*Video:.*?(\d{2,5})x(\d{2,5})/;
const EVEN_TOLERANCE = 0.02;
const MAX_BUFFER_BYTES = 512 * 1024 * 1024;

async function ffmpegBin(): Promise<string> {
  const bin = await ensureFfmpegPath();
  if (!bin) {
    throw new Error('ffmpeg is not available here');
  }
  return bin;
}

async function sizeOf(bin: string, src: string): Promise<{ width: number; height: number }> {
  const log = await run(bin, ['-hide_banner', '-i', src]).then(
    (done) => done.stderr,
    (failed: { stderr?: string }) => failed.stderr ?? ''
  );
  const match = SIZE_IN_LOG.exec(log);
  if (!match) {
    throw new Error('could not read the video size');
  }
  const source = { width: Number(match[1]), height: Number(match[2]) };
  const width = Math.min(TRACK_WIDTH, source.width);
  return { width, height: Math.max(1, Math.round((source.height * width) / source.width)) };
}

function stepOf(seconds: number[]): number {
  if (seconds.length < 2) {
    return 1;
  }
  const step = (seconds[seconds.length - 1] - seconds[0]) / (seconds.length - 1);
  const evenly = seconds.every((s, i) => Math.abs(s - (seconds[0] + i * step)) <= Math.abs(step) * EVEN_TOLERANCE);
  if (!evenly || step <= 0) {
    throw new Error('frames must be evenly spaced and forward in time: clear time remap and reverse first');
  }
  return step;
}

export const ffmpegLumas =
  (src: string): LumaReader =>
  async (seconds) => {
    const step = stepOf(seconds);
    const bin = await ffmpegBin();
    const { width, height } = await sizeOf(bin, src);
    const args = ['-v', 'error', '-ss', String(Math.max(0, seconds[0])), '-i', src, '-vf', `fps=${1 / step},scale=${width}:${height},format=gray`, '-frames:v', String(seconds.length), '-f', 'rawvideo', '-'];
    const { stdout } = await run(bin, args, { encoding: 'buffer', maxBuffer: MAX_BUFFER_BYTES });
    const size = width * height;

    if (stdout.length < size * seconds.length) {
      throw new Error('the video ends before the last frame asked for');
    }
    return seconds.map((_, i): Luma => ({ width, height, data: new Uint8Array(stdout.subarray(i * size, (i + 1) * size)) }));
  };
