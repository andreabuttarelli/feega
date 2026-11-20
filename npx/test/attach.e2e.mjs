import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const APP = resolve(process.env.FEEGA_E2E_APP ?? here('../../inspect/test/fixtures/react-css'));
const CLI = here('../dist/cli.cjs');
const VITE = join(APP, 'node_modules', 'vite', 'bin', 'vite.js');
const STRANGER_PORT = 51973;
const FIRST_EDITOR_PORT = 4731;
const SECOND_EDITOR_PORT = 4732;
const READY_MS = 120_000;
const STRANGER_TITLE = 'unrelated-vite-app';

const strangerDir = mkdtempSync(join(tmpdir(), 'feega-stranger-'));
writeFileSync(join(strangerDir, 'index.html'), `<!doctype html><html><head><title>${STRANGER_TITLE}</title></head><body></body></html>`);
const stranger = spawn(process.execPath, [VITE, '--port', String(STRANGER_PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: strangerDir, stdio: ['pipe', 'inherit', 'inherit'] });

const instances = [];

function instance(port) {
  const cli = spawn(process.execPath, [CLI, APP, '--port', String(port), '--no-open'], { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, FEEGA_STOP_ON_STDIN_END: '1' } });
  instances.push(cli);
  return new Promise((done, fail) => {
    let output = '';
    const timer = setTimeout(() => fail(new Error(`no editor on ${port}:\n${output}`)), READY_MS);
    cli.stdout.on('data', (data) => {
      output += data;
      if (!output.includes('editor ready on')) {
        return;
      }
      clearTimeout(timer);
      done({ output, appUrl: /app on (\S+)/.exec(output)?.[1] });
    });
    cli.once('exit', () => fail(new Error(`CLI exited early:\n${output}`)));
  });
}

async function strangerUp() {
  const end = Date.now() + READY_MS;
  while (Date.now() < end) {
    const page = await fetch(`http://127.0.0.1:${STRANGER_PORT}/`).then((r) => r.text(), () => '');
    if (page.includes(STRANGER_TITLE)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('the unrelated vite app did not start');
}

try {
  await strangerUp();

  const first = await instance(FIRST_EDITOR_PORT);
  assert.match(first.output, /started the dev server/, 'ignores the unrelated vite app and starts its own');
  assert.doesNotMatch(first.output, /attached to/);

  const second = await instance(SECOND_EDITOR_PORT);
  assert.match(second.output, /started the dev server/, 'does not attach to the first Feega instance');
  assert.doesNotMatch(second.output, /attached to/);
  assert.notEqual(second.appUrl, first.appUrl);

  const page = await fetch(second.appUrl).then((r) => r.text());
  assert.ok(!page.includes(STRANGER_TITLE), 'the preview is this project, not the unrelated app');
  assert.ok(page.includes('/src/main.jsx'), 'the preview is the fixture app');
  console.log('FEEGA_ATTACH_E2E_OK');
} finally {
  instances.forEach((cli) => cli.stdin.end());
  stranger.kill('SIGTERM');
}
