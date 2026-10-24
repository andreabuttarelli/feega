import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import type { FeegaMcp } from './feega-mcp';

const POLL_MS = 3000;
const RENDER_TIMEOUT_MS = 10 * 60 * 1000;
const READY_TIMEOUT_MS = 60 * 1000;
const START_BUTTON = 'render-start';

export type Rendered = { ok: boolean; seconds: number; bytes: number; detail: string };

type RenderState = { status?: string; file_url?: string };

async function waitForFile(mcp: FeegaMcp, runId: string, deadline: number): Promise<RenderState> {
  while (Date.now() < deadline) {
    const state = (await mcp.callJson('get_render', { run_id: runId })) as RenderState;
    if (state.status === 'done' || state.status === 'failed' || state.status === 'expired') {
      return state;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return { status: 'timeout' };
}

export async function renderThroughBrowser(mcp: FeegaMcp, frameId: string, outFile: string): Promise<Rendered> {
  const started = Date.now();
  const render = (await mcp.callJson('render_video', { node_id: frameId, mode: 'browser', resolution: '1080p' })) as { run_id: string; render_url: string };

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const logs: string[] = [];
    page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
    await page.goto(render.render_url, { waitUntil: 'domcontentloaded' });
    const start = page.getByTestId(START_BUTTON);
    const ready = await start.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS }).then(() => true, () => false);
    if (!ready) {
      return { ok: false, seconds: (Date.now() - started) / 1000, bytes: 0, detail: `render page never offered the start button; ${logs.slice(-6).join(' | ').slice(0, 400)}` };
    }
    await start.click();

    const state = await waitForFile(mcp, render.run_id, started + RENDER_TIMEOUT_MS);
    const seconds = (Date.now() - started) / 1000;
    if (state.status !== 'done' || !state.file_url) {
      return { ok: false, seconds, bytes: 0, detail: `${state.status}; ${logs.slice(-6).join(' | ').slice(0, 600)}` };
    }

    const bytes = Buffer.from(await (await fetch(state.file_url)).arrayBuffer());
    writeFileSync(outFile, bytes);
    return { ok: true, seconds, bytes: bytes.length, detail: 'done' };
  } finally {
    await browser.close();
  }
}
