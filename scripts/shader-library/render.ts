import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SHADER_LIBRARY, type LibraryShader } from '../../packages/shader-fx/src/library';
import { openHarness, type Frame, type Harness } from './harness';

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const SECONDS = 6;
const STILL_TIMES = [1.5, 3, 4.4];
const OUT = join(homedir(), 'Documents/feega-videos/shaders', process.argv[2] ?? `${new Date().toISOString().slice(0, 10)}-first-five`);

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const smooth = (a: number, b: number, x: number) => easeInOut(Math.min(1, Math.max(0, (x - a) / (b - a))));

const DRIVERS: Record<string, (t: number) => Record<string, number>> = {
  'voice-orb': (t) => ({ state: smooth(1.6, 2.3, t) + smooth(3.7, 4.3, t), energy: 0.75 }),
  'petal-field': (t) => ({ pointer_x: 0.2 + 0.6 * smooth(0, 6, t), pointer_y: 0.5 + 0.22 * Math.sin(t * 1.1) })
};

function frameAt(shader: LibraryShader, time: number): Frame {
  const values = { ...Object.fromEntries(shader.params.map((p) => [p.key, p.default])), ...DRIVERS[shader.name]?.(time) };
  return { name: shader.name, time, values, width: WIDTH, height: HEIGHT };
}

async function video(harness: Harness, shader: LibraryShader) {
  const ffmpeg = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-movflags', '+faststart', join(OUT, `${shader.name}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code === 0 ? resolve(code) : reject(new Error(`ffmpeg ${code}`)))));

  for (let f = 0; f < FPS * SECONDS; f++) {
    const png = await harness.render(frameAt(shader, f / FPS));
    if (!ffmpeg.stdin.write(png)) {
      await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    }
  }

  ffmpeg.stdin.end();
  await done;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const harness = await openHarness();
  const only = process.argv[3];

  for (const shader of SHADER_LIBRARY.filter((s) => !only || s.name === only)) {
    console.log(`${shader.name}: ${(await harness.costMs(shader.name)).toFixed(2)} ms per 1080p frame`);

    for (const [i, time] of STILL_TIMES.entries()) {
      await writeFile(join(OUT, `${shader.name}-${i + 1}.png`), await harness.render(frameAt(shader, time)));
    }

    await video(harness, shader);
  }

  await harness.close();
}

await main();
