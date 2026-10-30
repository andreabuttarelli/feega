import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { exportCode } from '@feega/motion-core/motion/codegen/index';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { imagesFilled } from '$lib/canvas/figma/images';
import { drawStill } from '$lib/server/motion/still-export';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import { similarity } from '$lib/server/web/ui-fidelity';
import { fontsWanted, urlPlan, type UrlPlan } from '$lib/server/url-import/url-doc';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { ComponentUse } from './component-marks';
import { codePlan } from './code-doc';
import { boardsOf, cropped } from './boards';
import { codeCapturedIn, codeScoredIn, FIDELITY_APPS, AppSource, type CapturedApp } from './fidelity-apps';
import { componentCount } from './import-code';

const LABEL = process.env.CODE_IMPORT_FIDELITY ?? '';
const ONLY = process.env.CODE_IMPORT_ONLY?.split(',');
const FOLD = { width: 1280, height: 800 };
const SIDE_GAP = 20;
const THUMB_WIDTH = 1600;
const STORY_MARGIN = 24;
const SPEC = { mime: 'image/png', ext: 'png', scale: 1, quality: undefined, size: () => FOLD } as never;
const WHITE = { r: 255, g: 255, b: 255 };

const captured = LABEL ? codeCapturedIn(process.env.CODE_IMPORT_CAPTURED ?? LABEL) : '';
const apps = captured && existsSync(captured) ? readdirSync(captured).filter((n) => existsSync(join(captured, n, 'capture.json')) && (!ONLY || ONLY.includes(n))) : [];

const band = (png: Buffer, top: number) => sharp(png).extract({ left: 0, top, ...FOLD }).png().toBuffer();

let cached: Record<string, string> = {};

async function inlined(url: string): Promise<string> {
  if (cached[url]) {
    return cached[url];
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!response?.ok) {
    return url;
  }
  return `data:font/woff2;base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
}

async function padded(png: Buffer, height: number): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const fitted = await sharp(png).resize({ width: FOLD.width }).png().toBuffer();
  const tall = Math.round((meta.height! * FOLD.width) / meta.width!);
  const top = await sharp(fitted).extract({ left: 0, top: 0, width: FOLD.width, height: Math.min(tall, height) }).png().toBuffer();
  return sharp({ create: { width: FOLD.width, height, channels: 3, background: WHITE } }).composite([{ input: top, left: 0, top: 0 }]).png().toBuffer();
}

async function sideBySide(a: Buffer, b: Buffer, height: number): Promise<Buffer> {
  const joined = await sharp({ create: { width: FOLD.width * 2 + SIDE_GAP, height, channels: 3, background: { r: 255, g: 0, b: 255 } } })
    .composite([
      { input: a, left: 0, top: 0 },
      { input: b, left: FOLD.width + SIDE_GAP, top: 0 }
    ])
    .png()
    .toBuffer();
  return sharp(joined).resize({ width: THUMB_WIDTH }).png().toBuffer();
}

async function scores(source: Buffer, drawn: Buffer) {
  const height = Math.floor((await sharp(source).metadata()).height! / FOLD.height) * FOLD.height || FOLD.height;
  const [a, b] = [await padded(source, height), await padded(drawn, height)];
  const bands: number[] = [];
  for (let top = 0; top + FOLD.height <= height; top += FOLD.height) {
    bands.push(await similarity(await band(a, top), await band(b, top)));
  }
  return { fold: bands[0], full: bands.reduce((s, v) => s + v, 0) / bands.length, a, b, height };
}

async function assetsOf(tree: PageTree, made: UrlPlan) {
  const faces = fontsWanted(tree);
  const assetOf = Object.fromEntries(Object.keys(made.images).map((hash) => [hash, `img-${hash}`]));
  const assets = { ...Object.fromEntries(Object.entries(made.images).map(([hash, url]) => [`img-${hash}`, cached[url] ?? url])), ...Object.fromEntries(await Promise.all(faces.map(async (f, i) => [`font-${i}`, await inlined(f.url)]))) };
  return { fonts: Object.fromEntries(faces.map((f, i) => [f.url, `font-${i}`])), assetOf, assets };
}

type Plan = (tree: PageTree, newId: () => string, fonts: Record<string, string>) => UrlPlan | null;

const coded = (uses: ComponentUse[]): Plan => (tree, newId, fonts) => codePlan(tree, uses, newId, fonts);
const plain: Plan = (tree, newId, fonts) => urlPlan(tree, newId, undefined, fonts);

async function drawn(tree: PageTree, plan: Plan): Promise<Buffer> {
  let n = 0;
  const first = plan(tree, () => `c${++n}`, {})!;
  const { fonts, assetOf, assets } = await assetsOf(tree, first);
  const made = plan(tree, () => `c${++n}`, fonts)!;
  const parts: { input: Buffer; top: number; left: number }[] = [];
  let top = 0;
  for (const item of made.plan.items) {
    const png = await drawStill(chromiumFrames, { doc: imagesFilled(item.doc, item.images, assetOf), tokens: FEEGA_TOKENS, assets }, SPEC);
    parts.push({ input: await sharp(png).resize({ width: FOLD.width, height: Math.round((item.size.height * FOLD.width) / item.size.width) }).png().toBuffer(), top, left: 0 });
    top += Math.round((item.size.height * FOLD.width) / item.size.width);
  }
  return sharp({ create: { width: FOLD.width, height: top, channels: 3, background: WHITE } }).composite(parts).png().toBuffer();
}

async function framed(png: Buffer, tree: PageTree, story: boolean): Promise<Buffer> {
  const boxes = (tree.root.children ?? []).flatMap((c) => (c.absoluteBoundingBox ? [c.absoluteBoundingBox] : []));
  if (!story || !boxes.length) {
    return png;
  }
  const meta = await sharp(png).metadata();
  const left = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.x))) - STORY_MARGIN);
  const top = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.y))) - STORY_MARGIN);
  const width = Math.min(meta.width! - left, Math.ceil(Math.max(...boxes.map((b) => b.x + b.width))) + STORY_MARGIN - left);
  const height = Math.min(meta.height! - top, Math.ceil(Math.max(...boxes.map((b) => b.y + b.height))) + STORY_MARGIN - top);
  const cut = await sharp(png).extract({ left, top, width, height }).png().toBuffer();
  return sharp(cut).resize({ width: FOLD.width, height: FOLD.height, fit: 'contain', background: WHITE }).png().toBuffer();
}

const mainsOf = (doc: MotionDoc) => Object.values(doc.comps).flatMap((c) => (c.component ? [`${c.component.name} ${JSON.stringify(c.component.variant ?? {})}`] : [])).sort();

describe.runIf(LABEL && apps.length)('an app imported from code painted again looks like the running app', () => {
  it.each(apps)('%s', async (name) => {
    const app = JSON.parse(readFileSync(join(captured, name, 'capture.json'), 'utf8')) as CapturedApp;
    const stored = join(captured, name, 'assets.json');
    cached = existsSync(stored) ? (JSON.parse(readFileSync(stored, 'utf8')) as Record<string, string>) : {};
    const story = FIDELITY_APPS[name]?.source === AppSource.Storybook;
    const out = join(codeScoredIn(LABEL), name);
    mkdirSync(out, { recursive: true });

    const pages = [];
    for (const [i, page] of app.pages.entries()) {
      const source = join(captured, name, `${app.pages.indexOf(page)}-source.png`);
      const picture = await drawn(page.tree, coded(page.uses));
      writeFileSync(join(out, `${i}-imported.png`), picture);
      const reference = existsSync(source) ? await framed(readFileSync(source), page.tree, story) : null;
      const scored = reference ? await scores(reference, await framed(picture, page.tree, story)) : null;
      const flat = reference ? await scores(reference, await framed(await drawn(page.tree, plain), page.tree, story)) : null;
      if (scored) {
        writeFileSync(join(out, `${i}-fold.png`), await sideBySide(await band(scored.a, 0), await band(scored.b, 0), FOLD.height));
        writeFileSync(join(out, `${i}-full.png`), await sideBySide(scored.a, scored.b, scored.height));
      }
      pages.push({ page: page.label, uses: page.uses.length, fold: scored?.fold ?? null, full: scored?.full ?? null, plainFold: flat?.fold ?? null, plainFull: flat?.full ?? null });
    }

    let n = 0;
    const boards = boardsOf(name, app.pages.map((p) => ({ label: p.label, tree: story ? cropped(p.tree, STORY_MARGIN) : p.tree, uses: p.uses })));
    const made = codePlan(boards.tree, boards.uses, () => `b${++n}`)!;
    const doc = made.plan.items[0].doc;
    for (const file of exportCode(doc, { name: 'Page' }).files) {
      const path = join(out, 'react', file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content);
    }
    const report = { ...componentCount(doc), frames: made.plan.items.length, uses: boards.uses.length, pages, mains: mainsOf(doc), skipped: made.plan.skipped };
    writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));

    expect(report.components).toBeGreaterThan(0);
  }, 600_000);
});
