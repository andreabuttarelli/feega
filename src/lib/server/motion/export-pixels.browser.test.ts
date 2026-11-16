import { createServer, type Server } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { CodeTarget, exportCode } from '@feega/motion-core/motion/codegen/index';
import { box, DocKit } from '@feega/motion-core/motion/codegen/fixtures/kit';
import { chromiumFrames, chromiumPage, serverFramesOpen } from './chromium-frames';
import { drawStill } from './still-export';
import { luma, ssim } from '../../../../scripts/gpu-parity/metrics';

const WIDTH = 480;
const HEIGHT = 320;
const MIN_SSIM = 0.99;
const TYPOGRAPHY_FLOOR = 0.88;
const DASH_FLOOR = 0.96;
const FLOORS: Record<string, number> = { 'text drop shadow': TYPOGRAPHY_FLOOR, 'plain text (typography baseline)': TYPOGRAPHY_FLOOR, 'uploaded font': TYPOGRAPHY_FLOOR, 'dashed outside stroke': DASH_FLOOR };
const MAX_MEAN_DIFF = 2;
const SPEC = { format: 'png', scale: 1, mime: 'image/png', ext: 'png', size: () => ({ width: WIDTH, height: HEIGHT }) } as never;
const FONT_FILE = join(import.meta.dirname, '../../../../landing/static/site/fonts/instrument-serif-latin.woff2');
const MIME: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.js': 'text/javascript' };
const stops = [
  { color: '#ff3b30', pos: 0 },
  { color: '#2f6bff', pos: 1 }
];
const solid = (color: string, extra: Record<string, unknown> = {}) => ({ type: 'solid', color, opacity: 1, visible: true, blend: 'normal', ...extra });

type Patch = (doc: MotionDoc) => void;

function page(draw: (kit: DocKit) => void): MotionDoc {
  const kit = new DocKit(WIDTH, HEIGHT);
  kit.frame('page', { name: 'Page', box: box(0, 0, WIDTH, HEIGHT), fill: '#ffffff' });
  draw(kit);
  return kit.doc();
}

const clipOf = (doc: MotionDoc, id: string) => doc.tracks[0].clips.find((c) => c.id === id)!;
const propsOf = (doc: MotionDoc, id: string) => clipOf(doc, id).props as Record<string, unknown>;

type Case = { name: string; doc: MotionDoc; urls?: Record<string, string> };

const strokeOf = (align: string, color: string) => ({ paint: solid(color), width: 16 / HEIGHT, align, dash: 0, gap: 0, cap: 'butt', join: 'miter', miter: 4, startCap: 'none', endCap: 'none', visible: true });

function cases(fontUrl: string): Case[] {
  const rect = (id: string, left: number, top: number, patch: (props: Record<string, unknown>) => void = () => {}) => (kit: DocKit) => kit.frame(id, { name: id, parent: 'page', box: box(left, top, 200, 140), fill: '#8ecae6', radius: 30 });
  const withProps = (doc: MotionDoc, id: string, props: Record<string, unknown>) => Object.assign(propsOf(doc, id), props);
  const blend = page((kit) => {
    rect('back', 40, 40)(kit);
    rect('front', 140, 120)(kit);
  });
  withProps(blend, 'back', { fills: [solid('#ffb703')] });
  withProps(blend, 'front', { fills: [solid('#219ebc')] });
  Object.assign(clipOf(blend, 'front'), { blend: 'multiply' });

  const fillBlend = page(rect('card', 40, 40));
  withProps(fillBlend, 'card', { fills: [solid('#ffb703'), { type: 'linear-gradient', stops, angle: 90, opacity: 1, visible: true, blend: 'multiply' }] });

  const gradients = page((kit) => {
    rect('radial', 20, 20)(kit);
    rect('angular', 250, 20)(kit);
    rect('diamond', 20, 170)(kit);
  });
  withProps(gradients, 'radial', { fills: [{ type: 'radial-gradient', stops, center: { x: 0.3, y: 0.7 }, radius: 0.8, opacity: 1, visible: true, blend: 'normal' }] });
  withProps(gradients, 'angular', { fills: [{ type: 'angular-gradient', stops, angle: 40, center: { x: 0.4, y: 0.5 }, opacity: 1, visible: true, blend: 'normal' }] });
  withProps(gradients, 'diamond', { fills: [{ type: 'diamond-gradient', stops, opacity: 1, visible: true, blend: 'normal' }] });

  const strokes = page((kit) => {
    ['centre', 'outside', 'inside'].forEach((id, i) => kit.frame(id, { name: id, parent: 'page', box: box(20 + i * 150, 60, 130, 130), fill: '#ffe8a3', radius: 28 }));
  });
  ['center', 'outside', 'inside'].forEach((align, i) => withProps(strokes, ['centre', 'outside', 'inside'][i], { strokes: [strokeOf(align, ['#d62828', '#2a9d8f', '#264653'][i])] }));

  const dashed = page(rect('card', 80, 80));
  withProps(dashed, 'card', { strokes: [{ ...strokeOf('outside', '#d62828'), width: 6 / HEIGHT, dash: 0.03, gap: 0.03 }] });

  const textShadow = page((kit) => kit.text('hello', 'Shadow', { parent: 'page', name: 'Hello', size: 90, weight: 700, font: 'sans', box: box(40, 90, 400, 120) }));
  Object.assign(clipOf(textShadow, 'hello'), { effects: [{ id: 's', kind: 'drop-shadow', enabled: true, params: { distance: 0, x: 8, y: 10, blur: 6, spread: 0, color: '#d62828', opacity: 1 } }] });

  const plainText = page((kit) => kit.text('hello', 'Shadow', { parent: 'page', name: 'Hello', size: 90, weight: 700, font: 'sans', box: box(40, 90, 400, 120) }));

  const masked = page(rect('card', 60, 40));
  Object.assign(clipOf(masked, 'card'), { mask: { kind: 'ellipse', mode: 'add', x: 0.27, y: 0.25, width: 0.2, height: 0.3, rotation: 0, feather: 0, expansion: 0, opacity: 1, invert: false, points: [[0.5, 0], [1, 1], [0, 1]], assetId: null, text: 'T' } });

  const fonted = page((kit) => kit.text('serif', 'Instrument', { parent: 'page', name: 'Serif', size: 96, font: 'Instrument Serif', box: box(30, 90, 420, 140) }));
  fonted.fonts = [{ family: 'Instrument Serif', source: 'upload', category: 'serif', weights: [400], italic: false, axes: [], variants: [{ assetId: 'font-1', weight: 400, italic: false }] }] as never;

  return [
    { name: 'blend mode', doc: blend },
    { name: 'fill blend', doc: fillBlend },
    { name: 'radial, angular and diamond gradients', doc: gradients },
    { name: 'centred, outside and inside strokes', doc: strokes },
    { name: 'dashed outside stroke', doc: dashed },
    { name: 'text drop shadow', doc: textShadow },
    { name: 'plain text (typography baseline)', doc: plainText },
    { name: 'ellipse mask', doc: masked },
    { name: 'uploaded font', doc: fonted, urls: { 'font-1': fontUrl } }
  ].map((item) => ({ ...item, doc: parsed(item.doc) }));
}

function parsed(doc: MotionDoc): MotionDoc {
  const verdict = parseMotionDoc(doc);
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}

async function meanDiff(a: Buffer, b: Buffer): Promise<number> {
  const [pa, pb] = await Promise.all([a, b].map((png) => sharp(png).flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer()));
  let total = 0;
  for (let i = 0; i < pa.length; i++) {
    total += Math.abs(pa[i] - pb[i]);
  }
  return total / pa.length;
}

const lumaOf = async (png: Buffer) => luma(new Uint8Array(await sharp(png).flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer()));

function serve(root: string, font: Buffer): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const bytes = path === '/source/font.woff2' ? font : (() => { try { return readFileSync(join(root, path)); } catch { return null; } })();
    if (!bytes) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' }).end(bytes);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${(server.address() as { port: number }).port}` })));
}

const REPORT: string[] = [];
const ready = Boolean(process.env.CHROMIUM_PATH) && serverFramesOpen();

describe.skipIf(!ready)('exported code against the canvas still', () => {
  const root = mkdtempSync(join(tmpdir(), 'export-pixels-'));
  let server: Server;
  let origin = '';

  beforeAll(async () => {
    ({ server, origin } = await serve(root, readFileSync(FONT_FILE)));
  });
  afterAll(() => {
    server?.close();
    console.log(`\nexport pixel gate (ssim, mean diff of 255)\n${REPORT.join('\n')}`);
  });

  it.each(['blend mode', 'fill blend', 'radial, angular and diamond gradients', 'centred, outside and inside strokes', 'dashed outside stroke', 'text drop shadow', 'plain text (typography baseline)', 'ellipse mask', 'uploaded font'])('%s looks the same exported as on the canvas', async (name) => {
    const item = cases(`${origin}/source/font.woff2`).find((c) => c.name === name)!;
    const still = await drawStill(chromiumFrames, { doc: item.doc, tokens: FEEGA_TOKENS, assets: item.urls ?? {} }, SPEC);

    const out = exportCode(item.doc, { target: CodeTarget.Html, name: 'Page', assets: item.urls ?? {} });
    const dir = join(root, name.replace(/\W+/g, '-'));
    for (const file of out.files) {
      mkdirSync(dirname(join(dir, file.path)), { recursive: true });
      writeFileSync(join(dir, file.path), file.content);
    }
    for (const asset of out.assets) {
      mkdirSync(dirname(join(dir, asset.path)), { recursive: true });
      writeFileSync(join(dir, asset.path), Buffer.from(await (await fetch(asset.url)).arrayBuffer()));
    }

    const tab = await chromiumPage();
    await tab.setViewport({ width: WIDTH, height: HEIGHT });
    await tab.goto(`${origin}/${dir.slice(root.length + 1)}/index.html`, { waitUntil: 'networkidle0' });
    await tab.evaluate(() => document.fonts.ready.then(() => undefined));
    const exported = Buffer.from(await tab.screenshot({ type: 'png' }));
    await tab.close();

    const [a, b] = await Promise.all([lumaOf(still), lumaOf(exported)]);
    const score = ssim(a, b, WIDTH, HEIGHT);
    const diff = await meanDiff(still, exported);
    REPORT.push(`${name.padEnd(40)} ssim ${score.toFixed(4)}  diff ${diff.toFixed(2)}`);
    writeFileSync(join(dir, 'canvas.png'), still);
    writeFileSync(join(dir, 'export.png'), exported);
    expect(score).toBeGreaterThanOrEqual(FLOORS[name] ?? MIN_SSIM);
    if (!FLOORS[name]) {
      expect(diff).toBeLessThanOrEqual(MAX_MEAN_DIFF);
    }
  }, 120_000);
});
