import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { MARK_LOBE, MARK_TURNS, MarkTone } from '../../src/lib/site/mark';
import { LOOP_SECONDS, STILL_AT, TextBand, frame, type Frame, type Layout } from './scene';

const HERE = import.meta.dirname;
const STATIC_DIR = resolve(HERE, '../../static');
const FONT = resolve(STATIC_DIR, 'site/fonts/bdo-grotesk-variable.woff2');
const OUT_DIR = process.argv[2] ?? resolve(homedir(), 'Documents/feega-videos/og');
const ONLY = process.argv[3];
const FPS = 30;
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

const LAYOUTS = {
  og: {
    w: 1200,
    h: 630,
    text: TextBand.On,
    lockup: { y: 44, h: 60 },
    statement: { y: 128, size: 50, width: 640 },
    heading: { y: 70, size: 54 },
    scene: { x: 40, y: 262, w: 1120, h: 350 }
  },
  wide: {
    w: 1200,
    h: 675,
    text: TextBand.On,
    lockup: { y: 52, h: 62 },
    statement: { y: 140, size: 52, width: 660 },
    heading: { y: 80, size: 56 },
    scene: { x: 40, y: 286, w: 1120, h: 370 }
  },
  square: {
    w: 1200,
    h: 1200,
    text: TextBand.On,
    lockup: { y: 210, h: 92 },
    statement: { y: 350, size: 76, width: 860 },
    heading: { y: 260, size: 80 },
    scene: { x: 60, y: 640, w: 1080, h: 440 }
  },
  scene: {
    w: 1200,
    h: 675,
    text: TextBand.Off,
    lockup: { y: 0, h: 0 },
    statement: { y: 0, size: 0, width: 0 },
    heading: { y: 0, size: 0 },
    scene: { x: 60, y: 60, w: 1080, h: 555 }
  }
} as const satisfies Record<string, Layout>;

type Still = { kind: 'still'; file: string; layout: Layout; publish?: string };
type Clip = { kind: 'clip'; file: string; layout: Layout; scale: number; from: number; seconds: number; crf: number; publish?: string };

const OUTPUTS: (Still | Clip)[] = [
  { kind: 'still', file: 'og-1200x630.png', layout: LAYOUTS.og, publish: 'og.png' },
  { kind: 'still', file: 'og-1200x675.png', layout: LAYOUTS.wide },
  { kind: 'still', file: 'og-1200x1200.png', layout: LAYOUTS.square },
  { kind: 'clip', file: 'og-1200x630.mp4', layout: LAYOUTS.og, scale: 1, from: 0, seconds: LOOP_SECONDS, crf: 24, publish: 'og.mp4' },
  { kind: 'clip', file: 'og-1920x1080.mp4', layout: LAYOUTS.wide, scale: 1.6, from: 0, seconds: LOOP_SECONDS, crf: 20 },
  { kind: 'clip', file: 'og-1080x1080.mp4', layout: LAYOUTS.square, scale: 0.9, from: 0, seconds: LOOP_SECONDS, crf: 20 },
  { kind: 'clip', file: 'og-scene-1920x1080.mp4', layout: LAYOUTS.scene, scale: 1.6, from: 2, seconds: 8, crf: 20 }
];

const MARK_BOX = 300;
const MARK_INSET = 42;
const markLobes = MARK_TURNS.map((turn) => `<path d="${MARK_LOBE}" transform="rotate(${turn} 150 150)"/>`).join('');
const wordmark = readFileSync(resolve(HERE, 'wordmark.svg'), 'utf8');
const lockup = wordmark.replace(/(<svg[^>]*>)/, `$1<svg x="${-MARK_INSET}" y="${-MARK_INSET}" width="${MARK_BOX}" height="${MARK_BOX}" viewBox="0 0 ${MARK_BOX} ${MARK_BOX}"><g fill="${MarkTone.Orange}">${markLobes}</g></svg>`);
const mark = readFileSync(resolve(HERE, 'feega-mark-animated.svg'), 'utf8');
const font = readFileSync(FONT).toString('base64');

const page = (layout: Layout) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'BDO Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{background:#000;width:${layout.w}px;height:${layout.h}px;overflow:hidden;font-family:'BDO Grotesk',sans-serif;color:#f0eee9}
#stage,#mark,#black{position:absolute;inset:0}
.scene{position:absolute;inset:0}
.chapter,.lockup,.statement{position:absolute;left:50%;transform:translateX(-50%);text-align:center}
.chapter{width:100%}
.eyebrow{color:#ff5100;font-weight:500;letter-spacing:.02em;margin-bottom:.5em}
.heading{font-weight:500;letter-spacing:-.03em;line-height:1}
.lockup svg{height:100%;width:auto;display:block}
.statement{font-weight:500;letter-spacing:-.03em;line-height:1.04;text-wrap:balance}
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

const shrinkPng = (file: string) =>
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', file, '-vf', 'split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none', `${file}.tmp.png`]);

async function still(browser: Browser, out: Still) {
  const tab = await open(browser, out.layout, 1);
  await apply(tab, frame(out.layout, STILL_AT, lockup));
  const file = resolve(OUT_DIR, out.file);
  await tab.screenshot({ path: file });
  await tab.context().close();
  shrinkPng(file);
  copyFileSync(`${file}.tmp.png`, file);
  rmSync(`${file}.tmp.png`);
  return file;
}

async function clip(browser: Browser, out: Clip) {
  const frames = resolve(OUT_DIR, 'frames', out.file);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });

  const tab = await open(browser, out.layout, out.scale);
  const count = Math.round(out.seconds * FPS);
  for (let i = 0; i < count; i++) {
    await apply(tab, frame(out.layout, out.from + i / FPS, lockup));
    await tab.screenshot({ path: resolve(frames, `${String(i).padStart(4, '0')}.png`) });
  }
  await tab.context().close();

  const file = resolve(OUT_DIR, out.file);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', resolve(frames, '%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(out.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', file]);
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
