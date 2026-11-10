const { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme, Menu } = require('electron');
const path = require('node:path');
const { copyFileSync } = require('node:fs');
const { watchUpdates } = require('./updates.cjs');
const { fileIn, withExtension, startFile, remember, EXTENSION } = require('./files.cjs');
const { startServer, freePort, LOOPBACK } = require('./server.cjs');
const { frameless, overlay } = require('./chrome.cjs');
const { start, authReturn, staysInside, keepInside, DEEP_LINK_SCHEME } = require('./routing.cjs');
const nativeCanvas = require('./native-canvas.cjs');

const START_URL_ENV = 'FEEGA_URL';
const hosted = Boolean(process.env[START_URL_ENV]);
let home = start(process.env[START_URL_ENV]);
const SERVER_ROOT_ENV = 'FEEGA_SERVER_ROOT';
const serverRoot = app.isPackaged ? path.join(process.resourcesPath, 'server') : process.env[SERVER_ROOT_ENV] || path.join(__dirname, '..', '..');
const statePath = () => path.join(app.getPath('userData'), 'state.json');
const freshFile = () => path.join(app.getPath('documents'), `Untitled${EXTENSION}`);
const FILE_FILTERS = [{ name: 'feega canvas', extensions: [EXTENSION.slice(1)] }];
const PRELOAD_FILE = 'preload.cjs';
const TRANSPARENT = '#00000000';
const nativeCanvasOn = nativeCanvas.wanted(process.env, process.platform);
const NativeCanvas = nativeCanvasOn ? nativeCanvas.loadAddon(__dirname) : null;
const userAgent = (window) => `${window.webContents.getUserAgent()} FeegaNative/${app.getVersion()}`;

let window = null;
let server = null;
let current = null;
let pending = null;
let port = null;
let switching = Promise.resolve();

function openFile(file) {
  switching = switching.then(() => switchTo(file)).catch((error) => dialog.showErrorBox('feega could not open the file', `${file}\n\n${error.message}`));
  return switching;
}

async function switchTo(file) {
  await server?.stop();
  server = null;
  server = await startServer({ root: serverRoot, file, port, env: process.env });
  current = file;
  remember(statePath(), file);
  app.addRecentDocument(file);
  window.setRepresentedFilename(file);
  await window.loadURL(server.url);
}

async function newFile() {
  const { canceled, filePath } = await dialog.showSaveDialog(window, { title: 'New canvas', defaultPath: freshFile(), filters: FILE_FILTERS });
  if (canceled || !filePath) {
    return;
  }
  await openFile(withExtension(filePath));
}

async function pickFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, { properties: ['openFile'], filters: FILE_FILTERS });
  if (canceled || !filePaths[0]) {
    return;
  }
  await openFile(filePaths[0]);
}

async function saveAs() {
  const { canceled, filePath } = await dialog.showSaveDialog(window, { title: 'Save canvas as', defaultPath: current ?? freshFile(), filters: FILE_FILTERS });
  if (canceled || !filePath || !current) {
    return;
  }
  const target = withExtension(filePath);
  await server?.stop();
  server = null;
  copyFileSync(current, target);
  await openFile(target);
}

function installMenu() {
  const file = {
    label: 'File',
    submenu: [
      { label: 'New Canvas…', accelerator: 'CmdOrCtrl+N', click: newFile },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: pickFile },
      { role: 'recentDocuments', submenu: [{ role: 'clearRecentDocuments' }] },
      { type: 'separator' },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: saveAs },
      { label: 'Show in Finder', click: () => current && shell.showItemInFolder(current) },
      { type: 'separator' },
      { role: 'close' }
    ]
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, file, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]));
}

function follow(deep) {
  if (!window) {
    return;
  }
  const target = authReturn(deep, window.webContents.getURL() || home.href);
  if (!target) {
    return;
  }
  window.loadURL(target);
  window.show();
  window.focus();
}

function deepLinkIn(argv) {
  return argv.find((arg) => arg.startsWith(DEEP_LINK_SCHEME));
}

function windowOptions() {
  const base = { width: 1440, height: 900, minWidth: 800, minHeight: 600, title: 'Feega', backgroundColor: '#0c0c0c', ...frameless(process.platform, nativeTheme.shouldUseDarkColors) };
  if (!NativeCanvas) {
    return base;
  }
  return { ...base, transparent: true, backgroundColor: TRANSPARENT, webPreferences: { preload: path.join(__dirname, PRELOAD_FILE) } };
}

function installNativeCanvas() {
  if (!NativeCanvas) {
    return;
  }
  nativeCanvas.install({
    ipcMain,
    NativeCanvas,
    handleOf: (contents) => BrowserWindow.fromWebContents(contents).getNativeWindowHandle(),
    trusted: (event) => staysInside(event.senderFrame.url, home.href)
  });
}

function open() {
  window = new BrowserWindow(windowOptions());
  if (process.platform !== 'darwin') {
    nativeTheme.on('updated', () => window?.setTitleBarOverlay(overlay(nativeTheme.shouldUseDarkColors)));
  }
  window.webContents.setUserAgent(userAgent(window));

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (staysInside(url, home.href)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  keepInside(window.webContents, home.href, (url) => shell.openExternal(url));

  if (hosted) {
    window.loadURL(home.href);
    return;
  }
  openFile(pending ?? fileIn(process.argv) ?? startFile(statePath(), freshFile()));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME.slice(0, -1));

  app.on('open-file', (event, file) => {
    event.preventDefault();
    if (!window) {
      pending = file;
      return;
    }
    openFile(file);
    window.focus();
  });

  app.on('second-instance', (_event, argv) => {
    const file = fileIn(argv);
    if (file && !hosted) {
      openFile(file);
      window?.focus();
      return;
    }
    const deep = deepLinkIn(argv);
    if (deep) {
      follow(deep);
      return;
    }
    window?.focus();
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    follow(url);
  });

  app.whenReady().then(async () => {
    if (!hosted) {
      port = await freePort();
      home = new URL(`http://${LOOPBACK}:${port}/`);
    }
    installNativeCanvas();
    installMenu();
    open();
    if (app.isPackaged) {
      watchUpdates({ fetch, current: app.getVersion(), ask: (options) => dialog.showMessageBox(window, options), open: (url) => shell.openExternal(url), every: setInterval });
    }
    const deep = deepLinkIn(process.argv);
    if (deep) {
      follow(deep);
    }
  });

  app.on('window-all-closed', () => app.quit());

  app.on('will-quit', (event) => {
    if (!server) {
      return;
    }
    event.preventDefault();
    const closing = server;
    server = null;
    closing.stop().finally(() => app.quit());
  });
}
