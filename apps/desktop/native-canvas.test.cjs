const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { Channel, wanted, addonPath, loadAddon, install } = require('./native-canvas.cjs');

function fakeIpc() {
  const handlers = new Map();
  return { handlers, handle: (c, f) => handlers.set(c, f), on: (c, f) => handlers.set(c, f) };
}

function fakeSender() {
  const listeners = {};
  return { id: 7, getZoomFactor: () => 2, isDestroyed: () => false, sent: [], send(c, m) { this.sent.push([c, m]); }, once: (e, f) => (listeners[e] = f), on: (e, f) => (listeners[e] = f), listeners };
}

function setup(trusted = () => true) {
  const ipcMain = fakeIpc();
  const made = [];
  class NativeCanvas {
    constructor(...args) { this.args = args; this.calls = []; this.closed = false; made.push(this); }
    setCamera(...a) { this.calls.push(['setCamera', ...a]); }
    frame() { this.calls.push(['frame']); }
    place(a) { this.calls.push(['place', a]); }
    picture(...a) { this.calls.push(['picture', ...a]); }
    close() { this.closed = true; }
  }
  install({ ipcMain, NativeCanvas, handleOf: () => Buffer.alloc(8), trusted });
  return { ipcMain, made, sender: fakeSender() };
}

test('the native canvas is opt-in and macOS only', () => {
  assert.ok(wanted({ FEEGA_NATIVE_CANVAS: '1' }, 'darwin'));
  assert.ok(!wanted({}, 'darwin'));
  assert.ok(!wanted({ FEEGA_NATIVE_CANVAS: '1' }, 'win32'));
});

test('a packaged app loads the addon from the unpacked archive', () => {
  assert.ok(addonPath('/A/app.asar').includes('app.asar.unpacked'));
});

test('a missing addon leaves the canvas on wasm instead of throwing', () => {
  assert.equal(loadAddon('/nowhere', () => { throw new Error('no file'); }), null);
});

test('attach scales the placement by the page zoom and reports back to the page', async () => {
  const { ipcMain, made, sender } = setup();
  await ipcMain.handlers.get(Channel.Attach)({ sender }, { x: 1, y: 2, width: 3, height: 4 }, 10, 20, [0, 0, 0]);

  assert.deepEqual(made[0].args[1], { x: 2, y: 4, width: 6, height: 8 });
  made[0].args[5](null, 'hello');
  assert.deepEqual(sender.sent, [[Channel.Report, 'hello']]);
});

test('a tick moves the camera once and asks for a frame', async () => {
  const { ipcMain, made, sender } = setup();
  await ipcMain.handlers.get(Channel.Attach)({ sender }, { x: 0, y: 0, width: 1, height: 1 }, 1, 1, [0, 0, 0]);
  ipcMain.handlers.get(Channel.Tick)({ sender }, { x: 1, y: 2, zoom: 3 });
  ipcMain.handlers.get(Channel.Tick)({ sender }, null);

  assert.deepEqual(made[0].calls, [['setCamera', 1, 2, 3], ['frame'], ['frame']]);
});

test('only whitelisted methods reach the addon', async () => {
  const { ipcMain, made, sender } = setup();
  await ipcMain.handlers.get(Channel.Attach)({ sender }, { x: 0, y: 0, width: 1, height: 1 }, 1, 1, [0, 0, 0]);
  ipcMain.handlers.get(Channel.Send)({ sender }, 'close');
  ipcMain.handlers.get(Channel.Send)({ sender }, 'picture', 'a', new Uint8Array([1, 2]), 1, 1);

  assert.equal(made[0].closed, false);
  assert.ok(Buffer.isBuffer(made[0].calls[0][2]));
});

test('a page outside the app origin cannot attach or draw', async () => {
  const { ipcMain, sender } = setup(() => false);
  await assert.rejects(async () => ipcMain.handlers.get(Channel.Attach)({ sender }, {}, 1, 1, [0, 0, 0]));
});

test('the previous canvas closes when a page attaches again', async () => {
  const { ipcMain, made, sender } = setup();
  const attach = ipcMain.handlers.get(Channel.Attach);
  await attach({ sender }, { x: 0, y: 0, width: 1, height: 1 }, 1, 1, [0, 0, 0]);
  await attach({ sender }, { x: 0, y: 0, width: 1, height: 1 }, 1, 1, [0, 0, 0]);

  assert.equal(made[0].closed, true);
  assert.equal(made[1].closed, false);
});

test('the preload speaks the same channels as the host', () => {
  const source = fs.readFileSync(path.join(__dirname, 'preload.cjs'), 'utf8');
  for (const channel of Object.values(Channel)) {
    assert.ok(source.includes(`'${channel}'`), channel);
  }
});
