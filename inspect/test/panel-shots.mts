import { readFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { fileEdits } from '../src/host/file-edits.ts';
import { ToHost, ToView } from '../src/messages.ts';

const APP_URL = process.env.INSPECT_APP_URL ?? 'http://localhost:5391/';
const APP_ROOT = process.env.INSPECT_APP_ROOT!;
const SHOTS = join(homedir(), 'Documents/feega-videos/shots/inspect');
const PANEL_PORT = 5999;
const PANEL_ORIGIN = `http://127.0.0.1:${PANEL_PORT}`;
const dist = fileURLToPath(new URL('../dist/webview/', import.meta.url));

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/panel.css">
<style>:root{--vscode-editor-background:#1f1f1f;--vscode-foreground:#cccccc;--vscode-sideBar-background:#181818;--vscode-focusBorder:#0078d4;--vscode-font-family:-apple-system,system-ui,sans-serif}</style>
<script>window.acquireVsCodeApi = () => ({ postMessage: (m) => window.toHost(m) });</script>
</head><body><div id="app"></div><script src="/panel.js"></script></body></html>`;

const edits = fileEdits(APP_ROOT);
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const reply = (m: unknown) => page.evaluate((msg) => window.postMessage(msg, '*'), m);

const server = createServer(async (req, res) => {
  const name = (req.url ?? '/').slice(1);
  if (!name) {
    res.writeHead(200, { 'content-type': 'text/html' }).end(PAGE);
    return;
  }
  res.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'text/javascript' }).end(await readFile(join(dist, name)));
}).listen(PANEL_PORT);

await page.exposeFunction('toHost', async (m: { kind: ToHost; ask?: never }) => {
  if (m.kind === ToHost.Ready) {
    await reply({ kind: ToView.App, url: APP_URL });
  }
  if (m.kind === ToHost.Edit) {
    const out = await edits.edit(m.ask!);
    await reply(out.ok ? { kind: ToView.Edited, ok: true, written: out.written } : { kind: ToView.Edited, ok: false, reason: out.reason });
  }
});

await page.goto(`${PANEL_ORIGIN}/`);
const frame = page.frameLocator('[data-testid=app-frame]');
await frame.locator('h1').first().waitFor();
await page.locator('.overlay').waitFor();

const heading = await frame.locator('h1').first().boundingBox();
await page.mouse.move(heading!.x + 40, heading!.y + 20);
await page.waitForTimeout(300);
await page.mouse.click(heading!.x + 40, heading!.y + 20);
await page.locator('[data-testid=selection]').waitFor();
await page.screenshot({ path: join(SHOTS, '1-select.png') });

const padding = page.locator('[data-field=padding-y] input.num');
await padding.fill('32');
await padding.press('Enter');
await page.locator('[data-field=color] input').evaluate((el: HTMLInputElement) => {
  el.value = '#0078d4';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(800);
await page.screenshot({ path: join(SHOTS, '2-edit.png') });

await page.waitForTimeout(1500);
await page.screenshot({ path: join(SHOTS, '3-result.png') });
console.log('status:', await page.locator('[data-testid=status]').textContent().catch(() => ''));
await browser.close();
server.close();
