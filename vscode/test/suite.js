const assert = require('node:assert/strict');
const vscode = require('vscode');

const STARTUP_MS = 240_000;

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

async function openCanvas() {
  const dev = process.env.FEEGA_DEV_SERVER;
  if (dev) {
    await vscode.workspace.getConfiguration('feega').update('devServerPath', dev, vscode.ConfigurationTarget.Global);
  }
  if (process.env.FEEGA_TEST_FILE) {
    return vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(process.env.FEEGA_TEST_FILE), 'feega.canvas');
  }
  return vscode.commands.executeCommand('feega.openProject');
}

exports.run = async () => {
  await openCanvas();
  const api = vscode.extensions.getExtension('AndreaButtarelli.feega');
  assert.ok(api.isActive, 'the extension activates');

  const servers = await until(() => api.exports.runningCanvases().length && api.exports.runningCanvases());
  assert.ok(servers, 'the canvas server answers');

  const [{ port }] = servers;
  const home = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
  assert.equal(home.status, 303, 'the local canvas serves its home');

  const mcp = api.exports.mcpServers();
  assert.deepEqual(mcp[0].args.slice(-2), ['--port', String(port)], 'MCP points at the open canvas');

  const git = await (await fetch(`http://127.0.0.1:${port}/local/git`)).json();
  console.log(`FEEGA_E2E_OK port=${port} mcp=${mcp[0].label} git=${JSON.stringify(git)}`);
};
