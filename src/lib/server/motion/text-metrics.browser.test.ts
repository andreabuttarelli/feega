import { existsSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { DocKit, box } from '@feega/motion-core/motion/codegen/fixtures/kit';
import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { googleFontsUrl, uploadFaceCss, usedFaces, type FontFace } from '@feega/motion-core/motion/fonts/model';
import { fontLoader } from '@feega/motion-core/motion/gpu-full/text/load';
import { shapedText } from '@feega/motion-core/motion/gpu-full/text/measure';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { estimatedText, type TextMeasure } from '@feega/motion-core/motion/layout/text-extent';
import { browserFontReader } from './shaped-compose';

const ENABLED = process.env.TEXT_METRICS === '1';
const CHROME_PATHS = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const UNIT = 1000;
const UPLOADED = 'Uploaded Serif';
const UPLOADED_SOURCE = 'https://fonts.googleapis.com/css2?family=Lora:wght@400&display=block';
const UPLOAD_ASSET = 'uploaded-serif';
const SHAPED_BOUND = 0.01;
const SHAPED_FLOOR_PX = 1;

const FAMILIES: readonly FontFace[] = [
  { family: 'Inter', source: 'google', category: 'sans', weights: [400, 700], italic: false, axes: [] },
  { family: 'Playfair Display', source: 'google', category: 'serif', weights: [400, 700], italic: false, axes: [] },
  { family: 'Roboto Mono', source: 'google', category: 'mono', weights: [400, 700], italic: false, axes: [] },
  { family: 'Roboto Flex', source: 'google', category: 'sans', weights: [400, 700], italic: false, axes: [['wght', 100, 1000]] },
  { family: 'Noto Sans JP', source: 'google', category: 'sans', weights: [400, 700], italic: false, axes: [] }
] as FontFace[];

const STRINGS: Record<string, string> = {
  latin: 'Ship the release notes your customers read',
  digits: 'Controllers at 1,400 companies · 2026 · $12.50',
  punctuation: 'Wait — really? “Yes”, (she said); it’s fine!',
  long: 'Antidisestablishmentarianism',
  caps: 'WAVEFORM AVATAR TYPOGRAPHY',
  cjk: '日本語のテキストを測る',
  emoji: 'Launch day 🚀✨🎉'
};

const FALLBACK_DRAWN_BY_THE_SYSTEM: ReadonlySet<string> = new Set(['emoji']);

const SIZES = [13, 20, 64];
const WEIGHTS = [400, 700];
const TRACKINGS = [0, -0.04, 0.1];

type Case = { id: string; family: string; size: number; weight: number; tracking: number; key: string; text: string };

const cases: Case[] = [...FAMILIES.map((f) => f.family), UPLOADED].flatMap((family) =>
  SIZES.flatMap((size) => WEIGHTS.flatMap((weight) => TRACKINGS.flatMap((tracking) => Object.entries(STRINGS).map(([key, text]) => ({ id: `${family}|${size}|${weight}|${tracking}|${key}`, family, size, weight, tracking, key, text })))))
);

function docOf(all: readonly Case[]): MotionDoc {
  const kit = new DocKit(UNIT, UNIT);
  all.forEach((c, i) => kit.text(`t${i}`, c.text, { size: c.size, weight: c.weight, tracking: c.tracking, font: c.family, leading: 1.2, box: box(0, 0, 100, 40) }));
  const uploaded = { family: UPLOADED, source: 'upload', category: 'serif', weights: [400, 700], italic: false, axes: [], variants: [{ assetId: UPLOAD_ASSET, weight: 400, italic: false }] } as unknown as FontFace;
  return { ...kit.doc(), fonts: [...FAMILIES, uploaded] };
}

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips) as MotionClip[];

async function uploadedUrl(): Promise<string> {
  const css = await fetch(UPLOADED_SOURCE).then((r) => r.text());
  return css.match(/url\((https:[^)]+)\)/)![1];
}

const widthOf = (measure: TextMeasure, clip: MotionClip) => measure('Text', clip.props, UNIT).width;

type Row = Case & { browser: number; estimate: number; shaped: number };

const relative = (seen: number, truth: number) => (seen - truth) / truth;

const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(q * values.length))];

function summary(rows: Row[], pick: (r: Row) => number) {
  const errors = rows.map((r) => relative(pick(r), r.browser));
  const abs = errors.map(Math.abs);
  return { p50: quantile(abs, 0.5), p90: quantile(abs, 0.9), max: Math.max(...abs), meanSigned: errors.reduce((s, e) => s + e, 0) / errors.length };
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function report(label: string, rows: Row[]) {
  const by = (pick: (r: Row) => number) => {
    const s = summary(rows, pick);
    return `p50 ${pct(s.p50)} p90 ${pct(s.p90)} max ${pct(s.max)} bias ${pct(s.meanSigned)}`;
  };
  console.log(`METRICS ${label.padEnd(22)} n=${String(rows.length).padStart(4)} estimate[${by((r) => r.estimate)}] shaped[${by((r) => r.shaped)}]`);
}

let browser: Browser;

beforeAll(async () => {
  if (ENABLED) {
    browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH ?? CHROME_PATHS.find((p) => existsSync(p)), headless: true });
  }
});

afterAll(async () => {
  await browser?.close();
});

async function browserWidths(doc: MotionDoc, assets: Record<string, string>, all: readonly Case[]): Promise<number[]> {
  const google = googleFontsUrl(usedFaces(doc), doc.fonts);
  const spans = all.map((c, i) => `<span id="t${i}" style="font-family:'${c.family}';font-weight:${c.weight};font-size:${c.size}px;letter-spacing:${c.tracking}em;line-height:1.2;white-space:pre;display:inline-block">${c.text}</span>`).join('<br>');
  const html = `<!doctype html><html><head>${google ? `<link rel="stylesheet" href="${google}">` : ''}<style>${uploadFaceCss(doc.fonts, assets)}</style></head><body>${spans}</body></html>`;
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      const used = [...document.querySelectorAll<HTMLElement>('span')].map((s) => `${getComputedStyle(s).fontWeight} 20px ${getComputedStyle(s).fontFamily}`);
      await Promise.all([...new Set(used)].map((f) => document.fonts.load(f, 'Aa1日🚀')));
      await document.fonts.ready;
    });
    return (await page.evaluate((n) => Array.from({ length: n }, (_, i) => document.getElementById(`t${i}`)!.getBoundingClientRect().width), all.length)) as number[];
  } finally {
    await page.close();
  }
}

describe.runIf(ENABLED)('text metrics: layout measure against Chromium', () => {
  it('reports estimate and shaped error per font, size and script', { timeout: 300_000 }, async () => {
    const doc = docOf(cases);
    const assets = { [UPLOAD_ASSET]: await uploadedUrl() };
    const fonts = await fontLoader(browserFontReader)(doc, assets, FEEGA_TOKENS);
    const shaped = shapedText({ fonts, smoothing: Smoothing.Plain });
    const clips = clipsOf(doc);
    const truth = await browserWidths(doc, assets, cases);
    const rows: Row[] = cases.map((c, i) => ({ ...c, browser: truth[i], estimate: widthOf(estimatedText, clips[i]), shaped: widthOf(shaped, clips[i]) }));

    report('all', rows);
    for (const family of [...FAMILIES.map((f) => f.family), UPLOADED]) {
      report(family, rows.filter((r) => r.family === family));
    }
    for (const key of Object.keys(STRINGS)) {
      report(key, rows.filter((r) => r.key === key));
    }
    for (const size of SIZES) {
      report(`${size}px`, rows.filter((r) => r.size === size));
    }
    for (const tracking of TRACKINGS) {
      report(`tracking ${tracking}`, rows.filter((r) => r.tracking === tracking));
    }
    const worst = [...rows].sort((a, b) => Math.abs(relative(b.shaped, b.browser)) - Math.abs(relative(a.shaped, a.browser))).slice(0, 8);
    worst.forEach((r) => console.log(`WORST-SHAPED ${r.id} browser ${r.browser.toFixed(2)} shaped ${r.shaped.toFixed(2)} estimate ${r.estimate.toFixed(2)}`));

    const off = rows.filter((r) => !FALLBACK_DRAWN_BY_THE_SYSTEM.has(r.key) && Math.abs(r.shaped - r.browser) > Math.max(SHAPED_FLOOR_PX, SHAPED_BOUND * r.browser));
    expect(off.map((r) => `${r.id}: browser ${r.browser.toFixed(1)} shaped ${r.shaped.toFixed(1)}`)).toEqual([]);
  });
});
