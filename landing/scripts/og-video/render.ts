import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { MARK_LOBE, MARK_TURNS, MarkTone } from '../../src/lib/site/mark.ts';

const HERE = import.meta.dirname;
const STATIC_DIR = resolve(HERE, '../../static');
const OUT_DIR = process.argv[2] ?? resolve(homedir(), 'Documents/feega-videos/og');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const FPS = 30;
const MASTER_SCALE = 2;
const SIZE = { w: 1200, h: 630 };
const VIDEO_CRF = 24;

enum Mode {
  Still = 'still',
  Video = 'video'
}

const base64 = (path: string) => readFileSync(path).toString('base64');

const MARK_BOX = 300;
const MARK_INSET = 42;
const markLobes = MARK_TURNS.map((turn) => `<path d="${MARK_LOBE}" transform="rotate(${turn} 150 150)"/>`).join('');
const wordmark = readFileSync(resolve(HERE, 'wordmark.svg'), 'utf8');
const lockup = wordmark.replace(/(<svg[^>]*>)/, `$1<svg x="${-MARK_INSET}" y="${-MARK_INSET}" width="${MARK_BOX}" height="${MARK_BOX}" viewBox="0 0 ${MARK_BOX} ${MARK_BOX}"><g fill="${MarkTone.Orange}">${markLobes}</g></svg>`);

const MARK_VIEW = MARK_BOX - 2 * MARK_INSET;
const markOnly = `<svg viewBox="${MARK_INSET} ${MARK_INSET} ${MARK_VIEW} ${MARK_VIEW}"><g fill="${MarkTone.Orange}">${markLobes}</g></svg>`;

const html = readFileSync(resolve(HERE, 'page.html'), 'utf8')
  .replace('{{SANS}}', base64(resolve(STATIC_DIR, 'site/fonts/bdo-grotesk-variable.woff2')))
  .replace('{{MONO}}', base64(resolve(STATIC_DIR, 'site/fonts/fragment-mono-latin.woff2')))
  .replace('{{SHOT}}', base64(resolve(STATIC_DIR, 'img/editor/selected.webp')))
  .replace('{{SCRIPT}}', readFileSync(resolve(HERE, 'timeline.js'), 'utf8'))
  .replace('{{MARK}}', markOnly)
  .replaceAll('{{LOCKUP}}', lockup);

const ffmpeg = (...args: string[]) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args]);

async function open(mode: Mode) {
  const context = await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, deviceScaleFactor: MASTER_SCALE });
  const tab = await context.newPage();
  await tab.setContent(html);
  await tab.evaluate((m) => document.body.setAttribute('data-mode', m), mode);
  await tab.evaluate(() => document.fonts.ready);
  return tab;
}

async function still() {
  const tab = await open(Mode.Still);
  const master = resolve(OUT_DIR, 'og@2x.png');
  await tab.screenshot({ path: master });
  await tab.context().close();

  const png = resolve(OUT_DIR, 'og.png');
  ffmpeg('-i', master, '-vf', `scale=${SIZE.w}:${SIZE.h}:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`, png);
  copyFileSync(png, resolve(STATIC_DIR, 'og.png'));
  return [master, png];
}

async function frames(tab: Page, dir: string) {
  const seconds = await tab.evaluate(() => (window as unknown as { LOOP_SECONDS: number }).LOOP_SECONDS);
  const count = Math.round(seconds * FPS);
  for (let i = 0; i < count; i++) {
    await tab.evaluate((t) => (window as unknown as { renderAt: (t: number) => void }).renderAt(t), i / FPS);
    await tab.screenshot({ path: resolve(dir, `${String(i).padStart(4, '0')}.png`) });
  }
}

async function video() {
  const dir = resolve(OUT_DIR, 'frames');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const tab = await open(Mode.Video);
  await frames(tab, dir);
  await tab.context().close();

  const pattern = resolve(dir, '%04d.png');
  const mp4 = resolve(OUT_DIR, 'og.mp4');
  ffmpeg('-framerate', String(FPS), '-i', pattern, '-vf', `scale=${SIZE.w}:${SIZE.h}:flags=lanczos`, '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'veryslow', '-tune', 'animation', '-crf', String(VIDEO_CRF), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4);
  const sheet = resolve(OUT_DIR, 'og-contact-sheet.png');
  ffmpeg('-i', pattern, '-vf', `select='not(mod(n\\,15))',scale=400:-1,tile=6x3:padding=8:color=white`, '-frames:v', '1', sheet);
  copyFileSync(mp4, resolve(STATIC_DIR, 'og.mp4'));
  rmSync(dir, { recursive: true, force: true });
  return [mp4, sheet];
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
try {
  const only = process.argv[3];
  const outputs = [...(only === Mode.Video ? [] : await still()), ...(only === Mode.Still ? [] : await video())];
  console.log(outputs.join('\n'));
} finally {
  await browser.close();
}
