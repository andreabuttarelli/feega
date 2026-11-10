const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { stopper } = require('./server.cjs');

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
