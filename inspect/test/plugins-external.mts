import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { readRegistry } from '@feega/plugin-store/registry';
import { breakpointsOf } from '../src/host/breakpoints.ts';
import { pluginsSession } from '../src/host/plugins-session.ts';
import { stylingOf } from '../src/host/styling.ts';
import { ServerState, ToHost, ToView, type HostMessage } from '../src/messages.ts';
import { DARK } from './harness.mts';

const PORT = Number(process.env.PANEL_PORT ?? 5998);
const dist = fileURLToPath(new URL('../dist/webview/', import.meta.url));
const APP = fileURLToPath(new URL('./fixtures/plugins-app', import.meta.url));
const HELLO = fileURLToPath(new URL('../../examples/feega-plugin-hello', import.meta.url));
const BUILT_IN = 'feega.mesh-gradient';
const HOT = '[data-plugin="example.hello"]';

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` ${detail}`}`);
  if (!ok) {
    failures.push(name);
  }
};

const root = mkdtempSync(join(tmpdir(), 'feega-e2e-root-'));
const dev = mkdtempSync(join(tmpdir(), 'feega-e2e-dev-'));
cpSync(HELLO, dev, { recursive: true });

const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/panel.css"><style>${DARK}</style>
<script>window.acquireVsCodeApi = () => ({ postMessage: (m) => window.toHost(m) });</script>
</head><body class="vscode-dark"><div id="app"></div><script src="/panel.js"></script></body></html>`;

const server = createServer(async (req, res) => {
  const name = (req.url ?? '/').slice(1);
  if (!name) {
    res.writeHead(200, { 'content-type': 'text/html' }).end(html);
    return;
  }
  res.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'text/javascript' }).end(await readFile(join(dist, name)));
}).listen(PORT);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reply = (m: unknown) => page.evaluate((msg) => window.postMessage(msg, '*'), m);

const plugins = pluginsSession({ host: { root, dev: () => [dev] }, post: reply, notify: () => undefined });

await page.exposeFunction('toHost', async (m: HostMessage) => {
  if (m.kind === ToHost.Ready) {
    await reply({ kind: ToView.App, url: 'about:blank', styling: await stylingOf(APP), prefs: null, breakpoints: await breakpointsOf(APP), themes: [] });
    await reply({ kind: ToView.Server, state: ServerState.Running });
    await plugins.show();
  }
  if (m.kind === ToHost.PluginEnable) {
    await plugins.enable(m.id, m.enabled);
  }
});

const openMenu = async () => {
  if ((await page.locator('[data-testid=open-plugins]').count()) === 0) {
    await page.locator('[data-testid=feega-menu]').click();
  }
};
const openBrowser = async () => {
  await openMenu();
  await page.locator('[data-testid=open-plugins]').click();
  await page.locator('[data-testid=plugin-grid]').waitFor();
};
const closeBrowser = () => page.locator('[data-testid=plugin-close]').click();
const sayHello = async () => {
  await openMenu();
  await page.locator('[data-testid=plugin-command]', { hasText: 'Say hello' }).click();
};

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.locator('[data-testid=feega-menu]').waitFor({ timeout: 30_000 });
  await openBrowser();
  await page.locator(HOT).waitFor({ timeout: 10_000 });

  check('the folder plugin is a community card', (await page.locator(`${HOT} [data-testid=plugin-badge]`).textContent()) === 'Community');
  check('a built-in is a by-Feega card', (await page.locator(`[data-plugin="${BUILT_IN}"] [data-testid=plugin-badge]`).textContent()) === 'By Feega');

  await page.locator(`${HOT} [data-testid=plugin-open]`).click();
  const badges = await page.locator('[data-testid=plugin-detail] .badge').allTextContents();
  check('the folder plugin detail says Dev and Not reviewed', badges.join() === 'Community,Dev,Not reviewed', badges.join());
  check('the permissions are readable in words', (await page.locator('[data-testid=plugin-detail] li').first().textContent()) === 'See which element you select');
  await page.locator('[data-testid=plugin-back]').click();
  await closeBrowser();

  await sayHello();
  await page.locator('.toast', { hasText: 'Hello. Select an element first.' }).waitFor({ timeout: 10_000 });
  check('the plugin runs in its sandboxed worker and answers through the host', true);

  writeFileSync(join(dev, 'plugin.js'), readFileSync(join(dev, 'plugin.js'), 'utf8').replace('Hello. Select an element first.', 'Reloaded.'));
  await page.waitForTimeout(1500);
  await sayHello();
  await page.locator('.toast', { hasText: 'Reloaded.' }).waitFor({ timeout: 10_000 });
  check('editing the folder reloads the plugin', true);

  await openBrowser();
  await page.locator(`${HOT} input[type=checkbox]`).uncheck();
  await page.waitForTimeout(600);
  await closeBrowser();
  check('switching it off removes its command', (await page.locator('[data-testid=plugin-command]', { hasText: 'Say hello' }).count()) === 0);
  check('the switch is kept in plugins.json', readRegistry(root).disabled.includes('example.hello'));

  await openBrowser();
  await page.locator(`[data-plugin="${BUILT_IN}"] input[type=checkbox]`).uncheck();
  await page.waitForTimeout(600);
  check('a built-in can be switched off too', readRegistry(root).disabled.includes(BUILT_IN));
} finally {
  await browser.close();
  server.close();
  plugins.stop();
}

if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
console.log('\nall passed');
process.exit(0);
