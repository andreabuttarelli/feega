import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { applyStack, type EffectId, type Pixels, type StackMemory } from '../../src/lib/canvas/effects/index';

const OUT = join(homedir(), 'Documents/feega-videos/shots/effects-typo');
const FHD = { width: 1920, height: 1080 };
const FPS = 30;
const SECONDS = 8;
const LOOKS: EffectId[] = ['word-weave', 'word-field', 'glyph-tiles', 'word-silhouette'];
const BEFORE = { rate: 3, scroll: 1, follow: 'off', fade: 0 };

const [person, landscape, video, ...references] = process.argv.slice(2);

async function decode(path: string): Promise<Pixels> {
  const { data, info } = await sharp(path).resize(FHD.width, FHD.height, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

function encode(pixels: Pixels) {
  return sharp(Buffer.from(pixels.data), { raw: { width: pixels.width, height: pixels.height, channels: 4 } });
}

const look = (id: EffectId, pixels: Pixels, time: number, params: Record<string, number | string> = {}, memory?: StackMemory) =>
  applyStack(pixels, [{ id, params, enabled: true }], undefined, time, memory);

async function sheet(name: string, panels: string[]) {
  const tiles = await Promise.all(panels.map((p) => sharp(p).resize(960, 960, { fit: 'contain', background: '#000' }).toBuffer()));
  await sharp({ create: { width: 960 * tiles.length, height: 960, channels: 3, background: '#000' } })
    .composite(tiles.map((input, i) => ({ input, left: i * 960, top: 0 })))
    .jpeg({ quality: 90 })
    .toFile(join(OUT, name));
}

async function stills() {
  for (const [label, path] of [['person', person], ['landscape', landscape]]) {
    const source = await decode(path);
    for (const id of LOOKS) {
      await encode(look(id, source, 0)).png().toFile(join(OUT, `${id}-${label}-fhd.png`));
    }
  }
  for (const [index, id] of LOOKS.entries()) {
    await sheet(`compare-${id}-fhd.jpg`, [references[index], join(OUT, `${id}-person-fhd.png`), join(OUT, `${id}-landscape-fhd.png`)]);
  }
}

async function render(frames: string[], dir: string, name: string, frame: (pixels: Pixels, time: number) => Pixels) {
  const outDir = mkdtempSync(join(dir, 'out-'));
  for (const [index, file] of frames.entries()) {
    await encode(frame(await decode(join(dir, file)), index / FPS)).png().toFile(join(outDir, file));
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(outDir, 'f-%04d.png'), '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', join(OUT, name)]);
  rmSync(outDir, { recursive: true, force: true });
}

async function clips() {
  const dir = mkdtempSync(join(tmpdir(), 'typo-'));
  const crop = `scale=${FHD.width}:${FHD.height}:force_original_aspect_ratio=increase,crop=${FHD.width}:${FHD.height},fps=${FPS}`;
  execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-t', String(SECONDS), '-vf', crop, join(dir, 'f-%04d.png')]);
  const frames = readdirSync(dir).filter((f) => f.startsWith('f-')).sort();

  for (const id of LOOKS) {
    const memory: StackMemory = new Map();
    await render(frames, dir, `${id}-video-after-fhd.mp4`, (pixels, time) => look(id, pixels, time, {}, memory));
    await render(frames, dir, `${id}-video-before-fhd.mp4`, (pixels, time) => look(id, pixels, time, BEFORE));
  }
  rmSync(dir, { recursive: true, force: true });
}

mkdirSync(OUT, { recursive: true });
await stills();
await clips();
