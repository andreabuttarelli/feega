import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export type Frame = { name: string; time: number; values: Record<string, number | string>; width: number; height: number; source?: string | null };

export type Harness = { render: (frame: Frame) => Promise<Buffer>; close: () => Promise<void> };

const ENTRY = fileURLToPath(new URL('./page-entry.ts', import.meta.url));
const PNG_PREFIX = 'data:image/png;base64,';
const GPU_FLAGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];

async function bundle(): Promise<string> {
  const result = await build({ entryPoints: [ENTRY], bundle: true, format: 'iife', write: false, platform: 'browser', logLevel: 'silent' });
  return result.outputFiles[0].text;
}

export async function openHarness(): Promise<Harness> {
  const [script, browser] = await Promise.all([bundle(), chromium.launch({ args: GPU_FLAGS })]);
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: script });

  return {
    render: async (frame) => {
      const url = await page.evaluate((f) => window.renderFrame({ ...f, source: f.source ?? null }), frame);
      return Buffer.from(url.slice(PNG_PREFIX.length), 'base64');
    },
    close: () => browser.close()
  };
}
