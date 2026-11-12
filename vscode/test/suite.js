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

exports.run = async () => {
  const file = vscode.Uri.file(process.env.FEEGA_TEST_FILE);
  await vscode.commands.executeCommand('vscode.openWith', file, 'feega.canvas');
  const api = vscode.extensions.getExtension('feega.feega');
  assert.ok(api.isActive, 'the extension activates on a .feega file');

  const servers = await until(() => api.exports.runningCanvases().length && api.exports.runningCanvases());
  assert.ok(servers, 'the canvas server answers');

  const [{ port }] = servers;
  const home = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
  assert.equal(home.status, 303, 'the local canvas serves its home');

  const mcp = api.exports.mcpServers();
  assert.deepEqual(mcp[0].args.slice(-2), ['--port', String(port)], 'MCP points at the open canvas');
  console.log(`FEEGA_E2E_OK port=${port} mcp=${mcp[0].label}`);
};
