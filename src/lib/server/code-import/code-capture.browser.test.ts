import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Page } from 'puppeteer-core';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { localBrowser } from '$lib/server/web/browser';
import { farmAccess } from '$lib/server/motion/vercel-farm';
import { RevealMode } from '$lib/server/url-import/page-reveal';
import { pagePrepared } from '$lib/server/url-import/import-url';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { ComponentUse } from './component-marks';
import { AppSource, codeCapturedIn, FIDELITY_APPS, type CapturedApp, type FidelityApp } from './fidelity-apps';
import { marksPlanner } from './import-code';
import { repoOf } from './repo';
import { sandboxRunner } from './sandbox-runner';
import { storybookPages } from './storybook';

const LABEL = process.env.CODE_IMPORT_CAPTURE ?? '';
const ONLY = process.env.CODE_IMPORT_ONLY?.split(',');
const SETTLE_MS = 1_200;
const BAND_PX = 4_000;
const STORIES = 16;
const REMOTE = /^https?:\/\//;

const refsIn = (node: RestNode): string[] => [...(node.fills ?? []).flatMap((f) => (f.imageRef && REMOTE.test(f.imageRef) ? [f.imageRef] : [])), ...(node.children ?? []).flatMap(refsIn)];

async function dataUrls(urls: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    [...new Set(urls)].map(async (url) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (!res?.ok) {
        return null;
      }
      const type = res.headers.get('content-type') ?? 'application/octet-stream';
      const data: string = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
      return [url, data] as const;
    })
  );
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => Boolean(e)));
}

async function fullShot(page: Page): Promise<Buffer> {
  const { width, height } = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: Math.min(Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0), 65_536) }));
  const bands: { input: Buffer; top: number; left: number }[] = [];
  for (let top = 0; top < height; top += BAND_PX) {
    const clip = { x: 0, y: top, width, height: Math.min(BAND_PX, height - top) };
    bands.push({ input: Buffer.from(await page.screenshot({ type: 'png', clip, captureBeyondViewport: true })), top, left: 0 });
  }
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } }).composite(bands).png().toBuffer();
}

type Started = { pages: { label: string; url: string }[]; names: string[]; stop: () => Promise<void> };

const START: Record<AppSource, (app: FidelityApp) => Promise<Started>> = {
  [AppSource.Repo]: async (app) => {
    const run = await sandboxRunner(farmAccess(process.env)!)(repoOf(app.at)!, null);
    if (!run.ok) {
      throw new Error(`${run.failure}: ${run.detail}`);
    }
    return { pages: app.pages.map((p) => ({ label: p, url: new URL(p, run.app.url).toString() })), names: run.app.names, stop: run.app.stop };
  },
  [AppSource.Storybook]: async (app) => {
    const stories = await storybookPages(app.at, fetch, STORIES);
    return { pages: stories?.pages ?? [], names: stories?.names ?? [], stop: async () => undefined };
  }
};

const APPS = Object.entries(FIDELITY_APPS).filter(([name]) => !ONLY || ONLY.includes(name));

describe.runIf(LABEL && process.env.CHROMIUM_PATH)('capture an app as code import reads it, and its screenshots', () => {
  it.each(APPS)('%s', async (name, app) => {
    const started = Date.now();
    const run = await START[app.source](app);
    const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
    const dir = join(codeCapturedIn(LABEL), name);
    mkdirSync(dir, { recursive: true });
    const captured: CapturedApp = { pages: [], names: run.names };
    try {
      for (const [i, target] of run.pages.entries()) {
        let page: Page | null = null;
        const tab = await localBrowser(async () => (page = await browser.newPage()))();
        const found = { uses: [] as ComponentUse[] };
        const refusal = await pagePrepared(tab, new URL(target.url), SETTLE_MS, marksPlanner(run.names, found));
        if (refusal) {
          await tab.close();
          continue;
        }
        const tree = (await tab.tree()) as PageTree;
        await tab.reveal(RevealMode.Still);
        writeFileSync(join(dir, `${i}-source.png`), await fullShot(page!));
        captured.pages.push({ label: target.label, url: target.url, tree, uses: found.uses });
        await tab.close();
      }
      const urls = captured.pages.flatMap((p) => [...refsIn(p.tree.root), ...(p.tree.fonts ?? []).map((f) => f.url)]);
      writeFileSync(join(dir, 'assets.json'), JSON.stringify(await dataUrls(urls)));
    } finally {
      await browser.close();
      await run.stop();
    }
    writeFileSync(join(dir, 'capture.json'), JSON.stringify(captured));
    writeFileSync(join(dir, 'timing.json'), JSON.stringify({ ms: Date.now() - started, pages: captured.pages.map((p) => [p.label, p.uses.length]) }, null, 2));

    expect(captured.pages.length).toBeGreaterThan(0);
  }, 600_000);
});
