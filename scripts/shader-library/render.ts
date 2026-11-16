import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { SHADER_LIBRARY, type LibraryShader } from '../../packages/shader-fx/src/library';
import { openHarness, type Frame, type Harness } from './harness';

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const SECONDS = 6;
const STILL_TIMES = [1.5, 3, 4.4];
const OUT = join(homedir(), 'Documents/feega-videos/shaders', process.argv[2] ?? `${new Date().toISOString().slice(0, 10)}-first-five`);

const CARD = `<!doctype html><html><body style="margin:0;width:${WIDTH}px;height:${HEIGHT}px;background:#ededf0;font-family:-apple-system,'SF Pro Display',Helvetica,sans-serif;position:relative;overflow:hidden;background-image:linear-gradient(#d9d9de 1px,transparent 1px),linear-gradient(90deg,#d9d9de 1px,transparent 1px);background-size:120px 120px">
<div style="position:absolute;left:150px;top:330px;font-size:290px;font-weight:600;letter-spacing:-0.05em;color:#111114">clarity</div>
<div style="position:absolute;left:162px;top:690px;font-size:56px;font-weight:500;letter-spacing:-0.03em;color:#5a5a62">light, bent on purpose.</div>
<div style="position:absolute;left:1260px;top:190px;width:440px;height:700px;background:#ff5a2e"></div>
<div style="position:absolute;left:1360px;top:300px;width:240px;height:240px;border-radius:50%;background:#1b2cff"></div>
</body></html>`;

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const smooth = (a: number, b: number, x: number) => easeInOut(Math.min(1, Math.max(0, (x - a) / (b - a))));

type Driven = Record<string, number>;

const DRIVERS: Record<string, (t: number) => Driven> = {
  'voice-orb': (t) => ({ state: smooth(1.6, 2.3, t) + smooth(3.7, 4.3, t), energy: 0.75 }),
  'veil-wipe': (t) => ({ progress: smooth(0.6, 2.6, t) - smooth(3.4, 5.4, t) })
};

const SOURCED = new Set(['liquid-lens', 'veil-wipe']);

async function sourceCard(): Promise<string> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.setContent(CARD);
  const png = await page.screenshot({ type: 'png' });
  await browser.close();
  return `data:image/png;base64,${png.toString('base64')}`;
}

function frameAt(shader: LibraryShader, time: number, source: string): Frame {
  const values = { ...Object.fromEntries(shader.params.map((p) => [p.key, p.default])), ...DRIVERS[shader.name]?.(time) };
  return { name: shader.name, time, values, width: WIDTH, height: HEIGHT, source: SOURCED.has(shader.name) ? source : null };
}

async function video(harness: Harness, shader: LibraryShader, source: string) {
  const ffmpeg = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow', '-movflags', '+faststart', join(OUT, `${shader.name}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ffmpeg.on('close', (code) => (code === 0 ? resolve(code) : reject(new Error(`ffmpeg ${code}`)))));

  for (let f = 0; f < FPS * SECONDS; f++) {
    const png = await harness.render(frameAt(shader, f / FPS, source));
    if (!ffmpeg.stdin.write(png)) {
      await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve));
    }
  }

  ffmpeg.stdin.end();
  await done;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const source = await sourceCard();
  await writeFile(join(OUT, 'source-card.png'), Buffer.from(source.split(',')[1], 'base64'));
  const harness = await openHarness();
  const only = process.argv[3];

  for (const shader of SHADER_LIBRARY.filter((s) => !only || s.name === only)) {
    for (const [i, time] of STILL_TIMES.entries()) {
      await writeFile(join(OUT, `${shader.name}-${i + 1}.png`), await harness.render(frameAt(shader, time, source)));
    }

    await video(harness, shader, source);
    console.log(`${shader.name} done`);
  }

  await harness.close();
}

await main();
