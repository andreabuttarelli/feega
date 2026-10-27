const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { watchUpdates, CHECK_EVERY_MS, RESTART } = require('./updates.cjs');

function fakes(choice) {
  const updater = new EventEmitter();
  updater.checks = 0;
  updater.installed = false;
  updater.checkForUpdates = async () => { updater.checks += 1; };
  updater.quitAndInstall = () => { updater.installed = true; };
  const timers = [];
  const ask = async () => ({ response: choice });
  return { updater, timers, ask, every: (fn, ms) => timers.push({ fn, ms }) };
}

test('checks on launch and then periodically', () => {
  const f = fakes(RESTART);
  watchUpdates(f);
  assert.equal(f.updater.checks, 1);
  assert.equal(f.timers[0].ms, CHECK_EVERY_MS);
  f.timers[0].fn();
  assert.equal(f.updater.checks, 2);
});

test('a downloaded update installs when the user restarts', async () => {
  const f = fakes(RESTART);
  watchUpdates(f);
  f.updater.emit('update-downloaded', { version: '0.2.0' });
  await new Promise(setImmediate);
  assert.ok(f.updater.installed);
});

test('a downloaded update waits when the user says later', async () => {
  const f = fakes(RESTART + 1);
  watchUpdates(f);
  f.updater.emit('update-downloaded', { version: '0.2.0' });
  await new Promise(setImmediate);
  assert.ok(!f.updater.installed);
});

test('a failed check does not crash the app', async () => {
  const f = fakes(RESTART);
  f.updater.checkForUpdates = async () => { throw new Error('offline'); };
  watchUpdates(f);
  await new Promise(setImmediate);
});
