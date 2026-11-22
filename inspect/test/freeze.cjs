const assert = require('node:assert/strict');
const { isAbsolute, join } = require('node:path');
const vscode = require('vscode');

const STARTUP_MS = 90_000;
const SETTLE_MS = 1500;
const REVEAL_MS = 8000;
const ROUNDS = 4;
const SPOTS = [[60, 40], [200, 300], [300, 200], [120, 120], [400, 400]];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(check) {
  const end = Date.now() + STARTUP_MS;
  while (Date.now() < end) {
    const value = await check();
    if (value) {
      return value;
    }
    await sleep(1000);
  }
  return null;
}

async function pickAny(api) {
  for (const [x, y] of SPOTS) {
    const found = await api.pick(x, y);
    if (found) {
      return found;
    }
  }
  return null;
}

exports.run = async () => {
  const sync = process.env.INSPECT_SYNC !== 'off';
  await vscode.workspace.getConfiguration('feegaInspect').update('syncSelection', sync, vscode.ConfigurationTarget.Global);

  const alone = process.env.INSPECT_ALONE === 'on';
  await vscode.commands.executeCommand('workbench.action.closeSidebar');
  await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
  if (!alone) {
    const other = await vscode.workspace.openTextDocument(join(process.env.INSPECT_TEST_DIR, 'package.json'));
    await vscode.window.showTextDocument(other, { viewColumn: vscode.ViewColumn.One });
  }

  const api = await vscode.extensions.getExtension('andreabuttarelli.feega').activate();
  await vscode.commands.executeCommand('feegaInspect.open');
  assert.ok(await until(() => api.url()), 'the dev server answers');
  assert.ok(await until(() => pickAny(api)), 'the first selection works');

  for (let round = 0; round < ROUNDS; round++) {
    await sleep(SETTLE_MS);
    const started = Date.now();
    const found = await pickAny(api);
    assert.ok(found, `selection ${round + 2} answers after the first one (sync ${sync ? 'on' : 'off'})`);
    if (alone) {
      assert.equal(vscode.window.tabGroups.all.length, 1, 'the panel is never split to reveal a source');
    }
    if (sync && !alone) {
      const path = isAbsolute(found.source.file) ? found.source.file : join(process.env.INSPECT_TEST_DIR, found.source.file);
      const shown = () => vscode.window.visibleTextEditors.some((e) => e.document.uri.fsPath === path);
      const end = Date.now() + REVEAL_MS;
      while (!shown() && Date.now() < end) {
        await sleep(200);
      }
      assert.ok(shown(), `the source of the selection (${path}) is revealed`);
    }
    console.log(`FEEGA_FREEZE round ${round} answered in ${Date.now() - started}ms`);
  }
  console.log('FEEGA_FREEZE_OK');
};
