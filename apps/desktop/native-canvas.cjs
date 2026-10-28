const path = require('node:path');

const ENV_FLAG = 'FEEGA_NATIVE_CANVAS';
const ENABLED = '1';
const SUPPORTED_PLATFORM = 'darwin';
const ADDON_FILE = path.join('native', 'feega_native_canvas.node');
const ASAR = 'app.asar';
const UNPACKED_ASAR = 'app.asar.unpacked';

const Channel = {
  Attach: 'native-canvas:attach',
  Send: 'native-canvas:send',
  Tick: 'native-canvas:tick',
  Place: 'native-canvas:place',
  Close: 'native-canvas:close',
  Stats: 'native-canvas:stats',
  Report: 'native-canvas:report'
};

const DEBUG_FLAG = 'FEEGA_NATIVE_DEBUG';
const SENDABLE = new Set(['picture', 'putGroup', 'appendGroup', 'patchGroup', 'dropGroup', 'patchUses', 'setOverlay', ...(process.env[DEBUG_FLAG] ? ['snapshot'] : [])]);

function wanted(env, platform) {
  return env[ENV_FLAG] === ENABLED && platform === SUPPORTED_PLATFORM;
}

function addonPath(dir) {
  return path.join(dir.replace(ASAR, UNPACKED_ASAR), ADDON_FILE);
}

function loadAddon(dir, load = require) {
  try {
    return load(addonPath(dir)).NativeCanvas;
  } catch (error) {
    console.warn('[native-canvas] addon unavailable, the canvas stays on wasm:', error.message);
    return null;
  }
}

function scaled(placement, zoom) {
  return { x: placement.x * zoom, y: placement.y * zoom, width: placement.width * zoom, height: placement.height * zoom };
}

function bytes(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

function install({ ipcMain, NativeCanvas, handleOf, trusted }) {
  const open = new Map();

  function close(id) {
    open.get(id)?.close();
    open.delete(id);
  }

  function attach(event, placement, width, height, background) {
    if (!trusted(event)) {
      throw new Error('native canvas refused for an untrusted page');
    }
    const sender = event.sender;
    close(sender.id);
    const zoom = sender.getZoomFactor();
    const report = (message) => {
      if (!sender.isDestroyed()) {
        sender.send(Channel.Report, message);
      }
    };
    const canvas = new NativeCanvas(handleOf(sender), scaled(placement, zoom), width, height, background, (error, message) => {
      if (!error) {
        report(message);
      }
    });
    open.set(sender.id, { canvas, zoom, close: () => canvas.close() });
    sender.once('destroyed', () => close(sender.id));
    sender.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) {
        close(sender.id);
      }
    });
  }

  const canvasOf = (event) => (trusted(event) ? open.get(event.sender.id) : undefined);

  ipcMain.handle(Channel.Attach, attach);

  ipcMain.on(Channel.Send, (event, method, ...args) => {
    const entry = canvasOf(event);
    if (!entry || !SENDABLE.has(method)) {
      return;
    }
    entry.canvas[method](...args.map((arg) => (ArrayBuffer.isView(arg) ? bytes(arg) : arg)));
  });

  ipcMain.on(Channel.Tick, (event, camera) => {
    const entry = canvasOf(event);
    if (!entry) {
      return;
    }
    if (camera) {
      entry.canvas.setCamera(camera.x, camera.y, camera.zoom);
    }
    entry.canvas.frame();
  });

  ipcMain.on(Channel.Place, (event, placement) => {
    const entry = canvasOf(event);
    entry?.canvas.place(scaled(placement, entry.zoom));
  });

  ipcMain.on(Channel.Close, (event) => close(event.sender.id));

  ipcMain.handle(Channel.Stats, (event) => canvasOf(event)?.canvas.stats() ?? null);

  return { closeAll: () => [...open.keys()].forEach(close) };
}

module.exports = { Channel, SENDABLE, wanted, addonPath, loadAddon, scaled, install };
