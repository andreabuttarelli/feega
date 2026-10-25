import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { Aspect, cameraAt, keyframesOf, type Point, type Rect } from './camera';
import { pointerAt, rippleAt } from './pointer';
import type { Recording } from './demo';

const FPS = 60;
const CURSOR_PX = 22;
const RIPPLE_PX = 26;
const OUT: Record<Aspect, { width: number; height: number }> = {
  [Aspect.Landscape]: { width: 1920, height: 1080 },
  [Aspect.Portrait]: { width: 1080, height: 1920 }
};
const TITLE_S = 1.8;
const END_S = 1.6;
const FADE_S = 0.4;
const OUT_DIR = join(homedir(), 'Documents', 'feega-videos', 'demos');
const FONT = new URL('../../static/fonts/bdo-grotesk-DemiBold.woff2', import.meta.url);

export type DemoCut = { slug: string; title: string; date?: string };

function frameAt(frames: Recording['frames'], t: number, from: number): number {
  let i = from;
  while (i + 1 < frames.length && frames[i + 1].t <= t) {
    i++;
  }
  return i;
}

type Size = { width: number; height: number };

async function cropFrame(file: string, cam: Rect, scale: number, meta: Size, size: Size): Promise<Buffer> {
  const out = size.width / cam.width;
  const left = Math.max(0, Math.floor(cam.x * scale));
  const top = Math.max(0, Math.floor(cam.y * scale));
  const right = Math.min(meta.width, Math.ceil((cam.x + cam.width) * scale) + 2);
  const bottom = Math.min(meta.height, Math.ceil((cam.y + cam.height) * scale) + 2);
  const width = Math.max(size.width, Math.round(((right - left) / scale) * out));
  const height = Math.max(size.height, Math.round(((bottom - top) / scale) * out));
  const ox = Math.min(width - size.width, Math.round(((cam.x * scale - left) / scale) * out));
  const oy = Math.min(height - size.height, Math.round(((cam.y * scale - top) / scale) * out));
  return sharp(file)
    .extract({ left, top, width: right - left, height: bottom - top })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .extract({ left: ox, top: oy, width: size.width, height: size.height })
    .removeAlpha()
    .raw()
    .toBuffer();
}

function overlaySvg(size: Size, cam: Rect, at: Point, ripple: number | null): Buffer {
  const k = size.width / cam.width;
  const x = (at.x - cam.x) * k;
  const y = (at.y - cam.y) * k;
  const c = (CURSOR_PX * k) / 24;
  const ring = ripple === null ? '' : `<circle cx="${x}" cy="${y}" r="${RIPPLE_PX * k * (0.3 + 1.2 * ripple)}" fill="rgba(59,130,246,${0.28 * (1 - ripple)})" stroke="rgba(59,130,246,${0.85 * (1 - ripple)})" stroke-width="${2 * k}"/>`;
  const arrow = `<path transform="translate(${x - 4 * c} ${y - 2.5 * c}) scale(${c})" d="M4 2.5 L4 19.5 L8.6 15.3 L11.5 21.8 L14.6 20.4 L11.8 14 L18 14 Z" fill="#0a0a0a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}">${ring}${arrow}</svg>`);
}

async function renderContent(rec: Recording, aspect: Aspect, file: string): Promise<void> {
  const size = OUT[aspect];
  const meta = (await sharp(rec.frames[0].file).metadata()) as Size;
  const scale = meta.width / rec.view.width;
  const keys = keyframesOf(rec.events, rec.view, rec.duration);
  const ffmpeg = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${size.width}x${size.height}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise<void>((resolve, reject) => ffmpeg.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)))));

  const total = Math.floor(rec.duration * FPS);
  let source = 0;
  for (let n = 0; n < total; n++) {
    const t = n / FPS;
    source = frameAt(rec.frames, t, source);
    const cam = cameraAt(keys, t, rec.view, aspect);
    const view = await cropFrame(rec.frames[source].file, cam, scale, meta, size);
    const overlay = overlaySvg(size, cam, pointerAt(rec.pointer, t, { x: rec.view.width / 2, y: rec.view.height / 2 }), rippleAt(rec.presses, t));
    const pixels = await sharp(view, { raw: { width: size.width, height: size.height, channels: 3 } }).composite([{ input: overlay }]).removeAlpha().raw().toBuffer();
    if (!ffmpeg.stdin.write(pixels)) {
      await new Promise((r) => ffmpeg.stdin.once('drain', r));
    }
  }
  ffmpeg.stdin.end();
  await done;
}

function cardHtml(size: { width: number; height: number }, body: string): string {
  const font = readFileSync(FONT).toString('base64');
  return `<!doctype html><html><head><style>
@font-face{font-family:'BDO Grotesk';font-weight:600;src:url(data:font/woff2;base64,${font}) format('woff2')}
html,body{margin:0;width:${size.width}px;height:${size.height}px;background:#111;display:flex;flex-direction:column;gap:${Math.round(size.width * 0.02)}px;align-items:center;justify-content:center}
h1{font-family:'BDO Grotesk';font-weight:600;letter-spacing:-0.05em;line-height:0.95;color:#fff;text-transform:lowercase;text-align:center;margin:0 8%;font-size:${Math.round(size.width * 0.075)}px}
p{margin:0;font-family:'BDO Grotesk';font-weight:600;letter-spacing:-0.04em;color:#fff;font-size:${Math.round(Math.min(size.width, size.height) * 0.12)}px}
</style></head><body>${body}</body></html>`;
}

async function renderCards(cut: DemoCut, dir: string): Promise<Record<Aspect, { title: string; end: string }>> {
  const browser = await chromium.launch();
  const cards = {} as Record<Aspect, { title: string; end: string }>;
  for (const aspect of Object.values(Aspect)) {
    const size = OUT[aspect];
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    const title = join(dir, `title-${aspect}.png`);
    const end = join(dir, `end-${aspect}.png`);
    await page.setContent(cardHtml(size, `<h1>${cut.title}</h1>`));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: title });
    await page.setContent(cardHtml(size, '<p>feega</p>'));
    await page.screenshot({ path: end });
    cards[aspect] = { title, end };
    await page.close();
  }
  await browser.close();
  return cards;
}

function assemble(title: string, content: string, end: string, duration: number, size: { width: number; height: number }, file: string) {
  const zoomIn = `zoompan=z='1+0.04*on/${Math.round(TITLE_S * FPS)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(TITLE_S * FPS)}:s=${size.width}x${size.height}:fps=${FPS}`;
  const filter = [
    `[0:v]${zoomIn},format=yuv420p,setsar=1[t]`,
    `[1:v]fps=${FPS},format=yuv420p,setsar=1[c]`,
    `[2:v]fps=${FPS},format=yuv420p,setsar=1[e]`,
    `[t][c]xfade=transition=fade:duration=${FADE_S}:offset=${TITLE_S - FADE_S}[tc]`,
    `[tc][e]xfade=transition=fade:duration=${FADE_S}:offset=${TITLE_S + duration - 2 * FADE_S}[v]`
  ].join(';');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', title, '-i', content, '-loop', '1', '-framerate', String(FPS), '-t', String(END_S), '-i', end, '-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file]);
}

export async function renderDemo(rec: Recording, cut: DemoCut): Promise<string[]> {
  mkdirSync(OUT_DIR, { recursive: true });
  const date = cut.date ?? new Date().toISOString().slice(0, 10);
  const cards = await renderCards(cut, rec.dir);
  const files: string[] = [];
  for (const aspect of Object.values(Aspect)) {
    const content = join(rec.dir, `content-${aspect}.mp4`);
    await renderContent(rec, aspect, content);
    const file = join(OUT_DIR, `${date}-${cut.slug}-${aspect}.mp4`);
    assemble(cards[aspect].title, content, cards[aspect].end, Math.floor(rec.duration * FPS) / FPS, OUT[aspect], file);
    files.push(file);
  }
  return files;
}

export function contactSheet(video: string, sheet: string, tiles = 12): void {
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString());
  const every = seconds / tiles;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vf', `fps=1/${every.toFixed(3)},scale=480:-1,tile=4x${Math.ceil(tiles / 4)}`, '-frames:v', '1', sheet]);
}

