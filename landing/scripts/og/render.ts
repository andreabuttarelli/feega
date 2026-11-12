import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { MARK_LOBE, MARK_TURNS, MarkTone } from '../../src/lib/site/mark';
import { HERO_HEADLINE } from '../../src/lib/site/home';
import { LOOP_SECONDS, STILL_AT, TextBand, frame, type Frame, type Layout } from './scene';

const HERE = import.meta.dirname;
const STATIC_DIR = resolve(HERE, '../../static');
const FONT = resolve(STATIC_DIR, 'site/fonts/bdo-grotesk-variable.woff2');
const SERIF = resolve(STATIC_DIR, 'site/fonts/instrument-serif-latin.woff2');
const OUT_DIR = process.argv[2] ?? resolve(homedir(), 'Documents/feega-videos/og');
const ONLY = process.argv[3];
const FPS = 30;
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

const SUPERSAMPLE = 2;
const HEADLINE = HERO_HEADLINE.join(' ');
const breakBefore = (...words: string[]) => words.reduce((text, word) => text.replace(` ${word}`, `<br>${word}`), HEADLINE);
const sized = (w: number, h: number) => ({ w, h, text: TextBand.On });

const LAYOUTS = {
  og: { ...sized(1200, 630), copy: { x: 56, y: 172, gap: 26 }, lockup: { h: 50 }, statement: { text: breakBefore('with', 'and team'), size: 62, width: 480 }, scene: { x: 560, y: 56, w: 590, h: 518 }, box: { x: 630, y: 120, w: 640, h: 560 } },
  wide: { ...sized(1200, 675), copy: { x: 60, y: 186, gap: 28 }, lockup: { h: 54 }, statement: { text: breakBefore('with', 'and team'), size: 64, width: 490 }, scene: { x: 570, y: 60, w: 580, h: 555 }, box: { x: 640, y: 130, w: 640, h: 600 } },
  square: { ...sized(1200, 1200), copy: { x: 96, y: 96, gap: 34 }, lockup: { h: 76 }, statement: { text: breakBefore('with'), size: 92, width: 1008 }, scene: { x: 96, y: 470, w: 1008, h: 634 }, box: { x: 250, y: 600, w: 1050, h: 700 } },
  scene: { w: 1200, h: 675, text: TextBand.Off, copy: { x: 0, y: 0, gap: 0 }, lockup: { h: 0 }, statement: { text: '', size: 0, width: 0 }, scene: { x: 140, y: 40, w: 920, h: 595 }, box: { x: 300, y: 110, w: 700, h: 525 } }
} as const satisfies Record<string, Layout>;

type Size = { w: number; h: number };
type Still = { kind: 'still'; file: string; layout: Layout; publish?: string };
type Clip = { kind: 'clip'; file: string; layout: Layout; size: Size; from: number; seconds: number; crf: number; publish?: string };

const OUTPUTS: (Still | Clip)[] = [
  { kind: 'still', file: 'og-1200x630.png', layout: LAYOUTS.og, publish: 'og.png' },
  { kind: 'still', file: 'og-1200x675.png', layout: LAYOUTS.wide },
  { kind: 'still', file: 'og-1200x1200.png', layout: LAYOUTS.square },
  { kind: 'clip', file: 'og-1200x630.mp4', layout: LAYOUTS.og, size: { w: 1200, h: 630 }, from: 0, seconds: LOOP_SECONDS, crf: 18, publish: 'og.mp4' },
  { kind: 'clip', file: 'og-1920x1080.mp4', layout: LAYOUTS.wide, size: { w: 1920, h: 1080 }, from: 0, seconds: LOOP_SECONDS, crf: 18 },
  { kind: 'clip', file: 'og-1080x1080.mp4', layout: LAYOUTS.square, size: { w: 1080, h: 1080 }, from: 0, seconds: LOOP_SECONDS, crf: 18 },
  { kind: 'clip', file: 'og-scene-1920x1080.mp4', layout: LAYOUTS.scene, size: { w: 1920, h: 1080 }, from: 2, seconds: 8, crf: 18 }
];

const MARK_BOX = 300;
const MARK_INSET = 42;
const markLobes = MARK_TURNS.map((turn) => `<path d="${MARK_LOBE}" transform="rotate(${turn} 150 150)"/>`).join('');
const wordmark = readFileSync(resolve(HERE, 'wordmark.svg'), 'utf8');
const lockup = wordmark.replace(/(<svg[^>]*>)/, `$1<svg x="${-MARK_INSET}" y="${-MARK_INSET}" width="${MARK_BOX}" height="${MARK_BOX}" viewBox="0 0 ${MARK_BOX} ${MARK_BOX}"><g fill="${MarkTone.Orange}">${markLobes}</g></svg>`);
const mark = readFileSync(resolve(HERE, 'feega-mark-animated.svg'), 'utf8');
const font = readFileSync(FONT).toString('base64');
const serif = readFileSync(SERIF).toString('base64');

const page = (layout: Layout) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Instrument Serif';src:url(data:font/woff2;base64,${serif}) format('woff2')}
@font-face{font-family:'BDO Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{background:#000;width:${layout.w}px;height:${layout.h}px;overflow:hidden;font-family:'BDO Grotesk',sans-serif;color:#f0eee9}
#stage,#mark,#black{position:absolute;inset:0}
.scene{position:absolute;inset:0}
.copy{position:absolute;display:flex;flex-direction:column;align-items:flex-start}
.slot{position:relative;width:100%}
.chapter{position:absolute;left:0;top:0;width:100%}
.eyebrow{color:#ff5100;font-weight:500;letter-spacing:.02em;margin-bottom:.4em}
.lockup svg{height:100%;width:auto;display:block}
.statement{font-family:'Instrument Serif',serif;font-weight:400;color:#fff;letter-spacing:-.04em;line-height:.95;text-wrap:balance}
#mark{display:flex;align-items:center;justify-content:center}
#mark svg{width:${Math.round(layout.h * 0.34)}px;height:${Math.round(layout.h * 0.34)}px}
#black{background:#000}
</style></head><body><div id="stage"></div><div id="mark">${mark}</div><div id="black"></div></body></html>`;

async function apply(tab: Page, f: Frame) {
  await tab.evaluate((f) => {
    document.getElementById('stage')!.innerHTML = f.html;
    const mark = document.getElementById('mark')!;
    mark.style.opacity = String(f.mark.opacity);
    mark.style.transform = `scale(${f.mark.scale})`;
    document.getElementById('black')!.style.opacity = String(f.black);
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = f.mark.ms;
    }
  }, f);
}

async function open(browser: Browser, layout: Layout, scale: number) {
  const context = await browser.newContext({ viewport: { width: layout.w, height: layout.h }, deviceScaleFactor: scale });
  const tab = await context.newPage();
  await tab.setContent(page(layout));
  await tab.evaluate(() => document.fonts.ready);
  return tab;
}

const ffmpeg = (...args: string[]) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args]);
const LANCZOS = (size: Size) => `scale=${size.w}:${size.h}:flags=lanczos`;

async function still(browser: Browser, out: Still) {
  const file = resolve(OUT_DIR, out.file);
  const raw = `${file}.raw.png`;
  const tab = await open(browser, out.layout, SUPERSAMPLE);
  await apply(tab, frame(out.layout, STILL_AT, lockup));
  await tab.screenshot({ path: raw });
  await tab.context().close();

  ffmpeg('-i', raw, '-vf', `${LANCZOS(out.layout)},split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none`, file);
  rmSync(raw);
  return file;
}

async function clip(browser: Browser, out: Clip) {
  const frames = resolve(OUT_DIR, 'frames', out.file);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });

  const tab = await open(browser, out.layout, (SUPERSAMPLE * out.size.w) / out.layout.w);
  const count = Math.round(out.seconds * FPS);
  for (let i = 0; i < count; i++) {
    await apply(tab, frame(out.layout, out.from + i / FPS, lockup));
    await tab.screenshot({ path: resolve(frames, `${String(i).padStart(4, '0')}.png`) });
  }
  await tab.context().close();

  const file = resolve(OUT_DIR, out.file);
  ffmpeg('-framerate', String(FPS), '-i', resolve(frames, '%04d.png'), '-vf', LANCZOS(out.size), '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-tune', 'animation', '-crf', String(out.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file);
  rmSync(frames, { recursive: true, force: true });
  return file;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  for (const out of OUTPUTS.filter((o) => !ONLY || o.file.includes(ONLY))) {
    const file = out.kind === 'still' ? await still(browser, out) : await clip(browser, out);
    if (out.publish) {
      copyFileSync(file, resolve(STATIC_DIR, out.publish));
    }
    console.log(file);
  }
} finally {
  await browser.close();
}
