const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { stopper, loginPath } = require('./server.cjs');

const exited = (child) => new Promise((resolve) => child.once('exit', resolve));

test('stopping a server that a signal already killed resolves', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  const gone = exited(child);
  child.kill('SIGKILL');
  await gone;
  await stopper(child)();
});

test('stopping a running server ends it', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  await stopper(child)();
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});

test('the login-shell PATH survives an rc file that prints a banner', () => {
  const run = () => 'Welcome back!\n__FEEGA_PATH__/opt/homebrew/bin:/Users/me/.local/bin__FEEGA_PATH__\n';
  assert.strictEqual(loginPath({ SHELL: '/bin/zsh', PATH: '/usr/bin' }, run), '/opt/homebrew/bin:/Users/me/.local/bin');
});

test('a login shell that fails keeps the inherited PATH', () => {
  const run = () => {
    throw new Error('timeout');
  };
  assert.strictEqual(loginPath({ SHELL: '/bin/zsh', PATH: '/usr/bin' }, run), '/usr/bin');
});
