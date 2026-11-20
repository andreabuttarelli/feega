const assert = require('node:assert/strict');
const vscode = require('vscode');

const STARTUP_MS = 90_000;

async function until(check) {
  const end = Date.now() + STARTUP_MS;
  while (Date.now() < end) {
    const value = await check();
    if (value) {
      return value;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}


exports.run = async () => {
  const api = await vscode.extensions.getExtension('andreabuttarelli.feega').activate();
  await vscode.commands.executeCommand('feegaInspect.open');
  const url = await until(() => api.url());
  assert.ok(url, 'the dev server answers');
  api.close();
  await new Promise((r) => setTimeout(r, 1500));
  const kept = await fetch(url).then(() => true, () => false);
  console.log(`feega lifecycle: after panel close the server ${kept ? 'is kept warm' : 'stopped'}`);
  await vscode.commands.executeCommand('feegaInspect.open');
  const reopened = await until(() => api.url());
  console.log(`feega lifecycle: reopen adopted ${reopened}`);
};
