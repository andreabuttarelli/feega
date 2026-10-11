import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const DURATION = /Duration: (\d+):(\d+):([0-9.]+)/;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
const MAX_BUFFER = 8 * 1024 * 1024;

async function durationOf(bin: string, file: string): Promise<number> {
  const probe = await run(bin, ['-hide_banner', '-i', file], { maxBuffer: MAX_BUFFER }).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? '' }));
  const m = DURATION.exec(probe.stderr);
  return m ? +m[1] * SECONDS_PER_HOUR + +m[2] * SECONDS_PER_MINUTE + +m[3] : 0;
}

export async function videoStills(video: Buffer, points: readonly number[], bin: string): Promise<Buffer[]> {
  const dir = await mkdtemp(join(tmpdir(), 'video-stills-'));
  try {
    const file = join(dir, 'clip');
    await writeFile(file, video);
    const seconds = await durationOf(bin, file);
    if (!seconds) {
      throw new Error('not a video ffmpeg can read');
    }
    return await Promise.all(
      points.map(async (point, i) => {
        const out = join(dir, `${i}.jpg`);
        await run(bin, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', (seconds * point).toFixed(2), '-i', file, '-frames:v', '1', '-q:v', '3', out]);
        return readFile(out);
      })
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
