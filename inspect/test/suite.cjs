const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vscode = require('vscode');

const STARTUP_MS = 90_000;
const SPOTS = [[60, 40], [200, 300], [300, 200], [120, 120], [400, 400]];

async function until(check) {
  const end = Date.now() + STARTUP_MS;
  while (Date.now() < end) {
    const value = await check();
    if (value) {
      return value;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

exports.run = async () => {
  const root = process.env.INSPECT_TEST_DIR;
  const ext = vscode.extensions.getExtension('andreabuttarelli.feega');
  const api = await ext.activate();
  await vscode.commands.executeCommand('feegaInspect.open');

  assert.ok(await until(() => api.url()), 'the dev server answers');
  const pick = await until(async () => {
    for (const [x, y] of SPOTS) {
      const found = await api.pick(x, y);
      if (found) {
        return found;
      }
    }
    return null;
  });
  assert.ok(pick, 'clicking the page selects an element with its source');

  const file = join(root, pick.source.file);
  const before = readFileSync(file, 'utf8');
  const at = `${pick.source.file}:${pick.source.line}:${pick.source.col}`;

  assert.ok((await api.edit({ at, prop: 'padding', side: 'y', value: '32px', rem: pick.rem, viewport: pick.viewport })).ok);
  assert.ok((await api.edit({ at, prop: 'color', value: '#0078d4', viewport: pick.viewport })).ok);
  const after = readFileSync(file, 'utf8');
  const changed = after.split('\n').filter((line, i) => line !== before.split('\n')[i]);
  assert.equal(changed.length, 1, 'one line changes');
  assert.match(changed[0], /py-8/);
  assert.match(changed[0], /text-\[#0078d4\]/);

  await api.undo();
  await api.undo();
  assert.equal(readFileSync(file, 'utf8'), before, 'undo restores the file');
  console.log(`FEEGA_INSPECT_E2E_OK ${at} ${changed[0].trim()}`);
};
