import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const APP = process.env.FEEGA_E2E_APP ? resolve(process.env.FEEGA_E2E_APP) : here('../../inspect/test/fixtures/vite-vanilla');
const CLI = here('../dist/cli.cjs');
const READY_MS = 120_000;
const FIRST_PORT = 4731;
const SECOND_PORT = 4732;

const home = mkdtempSync(join(tmpdir(), 'feega-mcp-'));
const env = { ...process.env, HOME: home, USERPROFILE: home, FEEGA_STOP_ON_STDIN_END: '1' };

function started(port) {
  const cli = spawn(process.execPath, [CLI, APP, '--port', String(port), '--no-open'], { stdio: ['pipe', 'pipe', 'inherit'], env });
  return new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error('the editor did not start')), READY_MS);
    cli.stdout.on('data', (data) => {
      process.stdout.write(data);
      const url = /editor ready on (\S+)/.exec(String(data))?.[1];
      if (url) {
        clearTimeout(timer);
        done({ cli, url });
      }
    });
    cli.once('exit', (code) => fail(new Error(`the CLI exited before it was ready: ${code}`)));
  });
}

async function mcpClient() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [CLI, 'mcp'], cwd: APP, env, stderr: 'inherit' });
  const client = new Client({ name: 'feega-e2e', version: '0.0.0' });
  await client.connect(transport);
  return client;
}

const call = async (client, name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  return { error: Boolean(result.isError), text: result.content.map((part) => part.text).join('\n') };
};

const stop = (cli) => {
  cli.stdin.end();
  return new Promise((done) => cli.once('exit', done));
};

const client = await mcpClient();
let first;
let second;
let browser;
try {
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  for (const name of ['feega_editors', 'feega_selection', 'feega_changes']) {
    assert.ok(tools.includes(name), `${name} is listed`);
  }

  const none = await call(client, 'feega_selection');
  assert.ok(none.error && /No Feega editor is running/.test(none.text), `no editor message: ${none.text}`);
  assert.deepEqual(JSON.parse((await call(client, 'feega_editors')).text).editors, []);

  first = await started(FIRST_PORT);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(first.url);
  await page.getByText('Click an element to edit it').waitFor({ timeout: READY_MS });
  await page.getByRole('alertdialog').waitFor({ timeout: 3000 }).then(() => page.keyboard.press('Escape'), () => undefined);

  const empty = JSON.parse((await call(client, 'feega_selection')).text);
  assert.equal(empty.context, null, 'nothing selected yet');

  await page.frameLocator('[data-testid="app-frame"]').locator('h1').first().click();
  await page.waitForTimeout(1000);

  const selection = JSON.parse((await call(client, 'feega_selection')).text);
  assert.ok(selection.context?.includes('index.html'), `selection names the source file: ${selection.context}`);
  assert.ok(selection.context.includes('h1'), 'selection names the element');

  const changes = JSON.parse((await call(client, 'feega_changes')).text);
  assert.deepEqual(changes.changes, [], 'no edits yet');

  const editors = JSON.parse((await call(client, 'feega_editors')).text).editors;
  assert.equal(editors.length, 1);
  assert.equal(editors[0].project, APP);

  second = await started(SECOND_PORT);
  const both = JSON.parse((await call(client, 'feega_editors')).text).editors;
  assert.equal(both.length, 2, 'two editors on the same root');
  const stillFirst = JSON.parse((await call(client, 'feega_selection')).text);
  assert.equal(stillFirst.context, null, 'the most recently started editor answers');
} finally {
  await browser?.close();
  await client.close();
  await Promise.all([first && stop(first.cli), second && stop(second.cli)]);
  rmSync(home, { recursive: true, force: true });
}
