import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Frame } from './frames';

const STILL_WIDTH = 960;
const STILL_QUALITY = 4;
const OUTPUT_TAIL = 600;
const MAX_BUFFER = 16 * 1024 * 1024;

export type LocalPorts = {
  tempDir: () => Promise<string>;
  write: (path: string, text: string) => Promise<void>;
  run: (cmd: string, args: string[]) => Promise<{ code: number; output: string }>;
  read: (path: string) => Promise<Buffer>;
  remove: (dir: string) => Promise<void>;
};

type StillJob = { html: string; fps: number };

export function localStills(ports: LocalPorts) {
  return async (job: StillJob, times: number[]): Promise<Frame[]> => {
    const dir = await ports.tempDir();
    try {
      await ports.write(join(dir, 'index.html'), job.html);
      const video = join(dir, 'out.mp4');
      const render = await ports.run('npx', ['hyperframes', 'render', dir, '-o', video, '-q', 'draft', '-f', String(job.fps), '--quiet']);
      if (render.code !== 0) {
        throw new Error(`local render failed: ${render.output.slice(-OUTPUT_TAIL)}`);
      }
      const frames: Frame[] = [];
      for (const [i, time] of times.entries()) {
        const still = join(dir, `still-${i}.jpg`);
        await ports.run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(time), '-i', video, '-frames:v', '1', '-vf', `scale=${STILL_WIDTH}:-2`, '-q:v', String(STILL_QUALITY), still]);
        frames.push({ time, bytes: await ports.read(still) });
      }
      return frames;
    } finally {
      await ports.remove(dir);
    }
  };
}

export const machinePorts: LocalPorts = {
  tempDir: () => mkdtemp(join(tmpdir(), 'feega-deep-')),
  write: (path, text) => writeFile(path, text),
  run: (cmd, args) =>
    new Promise((resolve) => {
      execFile(cmd, args, { maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => resolve({ code: error ? 1 : 0, output: `${stdout}${stderr}${error ? error.message : ''}` }));
    }),
  read: (path) => readFile(path),
  remove: (dir) => rm(dir, { recursive: true, force: true })
};
