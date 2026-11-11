const { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme, Menu, session } = require('electron');
const path = require('node:path');
const { copyFileSync } = require('node:fs');
const { watchUpdates } = require('./updates.cjs');
const { fileIn, withExtension, savedBounds, saveBounds, EXTENSION } = require('./files.cjs');
const { startServer, freePort, LOOPBACK } = require('./server.cjs');
const { frameless, overlay, offlinePage, unreachable } = require('./chrome.cjs');
const { start, browsable, heldLink, authReturn, staysInside, keepInside, settingsUrl, droppedCanvas, DEEP_LINK_SCHEME } = require('./routing.cjs');

const START_URL_ENV = 'FEEGA_URL';
const hosted = start(process.env[START_URL_ENV]);
const SERVER_ROOT_ENV = 'FEEGA_SERVER_ROOT';
const serverRoot = app.isPackaged ? path.join(process.resourcesPath, 'server') : process.env[SERVER_ROOT_ENV] || path.join(__dirname, '..', '..');
const windowStatePath = () => path.join(app.getPath('userData'), 'window.json');
const freshFile = () => path.join(app.getPath('documents'), `Untitled${EXTENSION}`);
const FILE_FILTERS = [{ name: 'feega canvas', extensions: [EXTENSION.slice(1)] }];
const PRELOAD_FILE = 'preload.cjs';
const SECURE_PREFERENCES = { contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true };
const TRANSPARENT = '#00000000';
const DOCS_URL = 'https://docs.feega.app';
const INSTALL_GUIDE_URL = `${DOCS_URL}/desktop/install-macos/`;
const nativeCanvas = app.isPackaged ? null : require('./native-canvas.cjs');
const NativeCanvas = nativeCanvas?.wanted(process.env, process.platform, app.isPackaged) ? nativeCanvas.loadAddon(__dirname) : null;
const userAgent = (window) => `${window.webContents.getUserAgent()} FeegaNative/${app.getVersion()}`;

let home = hosted;
let window = null;
let server = null;
let current = null;
let pending = null;
let port = null;
let switching = Promise.resolve();
const earlyLink = heldLink();

function queue(step) {
  switching = switching.then(step).catch((error) => dialog.showMessageBox(window, { type: 'error', message: 'feega could not open that', detail: error.message }));
  return switching;
}

const openFile = (file) => queue(() => switchTo(file));

const openHosted = (target = hosted.href) => queue(() => backToHosted(target));

async function stopServer() {
  const closing = server;
  server = null;
  await closing?.stop();
}

async function switchTo(file) {
  await stopServer();
  port ??= await freePort();
  server = await startServer({ root: serverRoot, file, port, env: process.env });
  current = file;
  home = new URL(`http://${LOOPBACK}:${port}/`);
  app.addRecentDocument(file);
  window.setRepresentedFilename(file);
  installMenu();
  await window.loadURL(server.url);
}

async function backToHosted(target) {
  await stopServer();
  current = null;
  home = hosted;
  window.setRepresentedFilename('');
  installMenu();
  await window.loadURL(target);
}

async function newFile() {
  const { canceled, filePath } = await dialog.showSaveDialog(window, { title: 'New local canvas', defaultPath: freshFile(), filters: FILE_FILTERS });
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
  const source = current;
  await stopServer();
  copyFileSync(source, target);
  await openFile(target);
}

function openSettings() {
  if (current) {
    return;
  }
  window?.loadURL(settingsUrl(window.webContents.getURL(), hosted.href));
}

function installMenu() {
  const local = Boolean(current);
  const appMenu = {
    role: 'appMenu',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', enabled: !local, click: openSettings },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  };
  const file = {
    label: 'File',
    submenu: [
      { label: 'New Local Canvas…', click: newFile },
      { label: 'Open Local File…', accelerator: 'CmdOrCtrl+O', click: pickFile },
      { role: 'recentDocuments', submenu: [{ role: 'clearRecentDocuments' }] },
      { type: 'separator' },
      { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', enabled: local, click: saveAs },
      { label: 'Show in Finder', enabled: local, click: () => current && shell.showItemInFolder(current) },
      { label: 'Back to feega', enabled: local, click: () => openHosted() },
      { type: 'separator' },
      { role: 'close' }
    ]
  };
  const help = {
    role: 'help',
    submenu: [
      { label: 'feega Documentation', click: () => shell.openExternal(DOCS_URL) },
      { label: 'Install Guide', click: () => shell.openExternal(INSTALL_GUIDE_URL) }
    ]
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([appMenu, file, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }, help]));
}

function follow(deep) {
  if (!window) {
    return;
  }
  const target = authReturn(deep, hosted.href);
  if (!target) {
    return;
  }
  openHosted(target);
  window.show();
  window.focus();
}

function deepLinkIn(argv) {
  return argv.find((arg) => arg.startsWith(DEEP_LINK_SCHEME));
}

function leave(url) {
  const canvas = droppedCanvas(url);
  if (canvas) {
    openFile(canvas);
    return;
  }
  if (browsable(url)) {
    shell.openExternal(url);
  }
}

function windowOptions() {
  const base = { width: 1440, height: 900, ...savedBounds(windowStatePath()), minWidth: 800, minHeight: 600, title: 'Feega', backgroundColor: '#0c0c0c', ...frameless(process.platform, nativeTheme.shouldUseDarkColors) };
  if (!NativeCanvas) {
    return { ...base, webPreferences: SECURE_PREFERENCES };
  }
  return { ...base, transparent: true, backgroundColor: TRANSPARENT, webPreferences: { ...SECURE_PREFERENCES, preload: path.join(__dirname, PRELOAD_FILE) } };
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

function saveDownloadsWithDialog() {
  session.defaultSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
  });
}

function open() {
  window = new BrowserWindow(windowOptions());
  if (process.platform !== 'darwin') {
    nativeTheme.on('updated', () => window?.setTitleBarOverlay(overlay(nativeTheme.shouldUseDarkColors)));
  }
  window.webContents.setUserAgent(userAgent(window));
  window.on('close', () => saveBounds(windowStatePath(), window.getNormalBounds()));

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (staysInside(url, home.href)) {
      return { action: 'allow' };
    }
    leave(url);
    return { action: 'deny' };
  });

  keepInside(window.webContents, () => home.href, leave);

  window.webContents.on('did-fail-load', (_event, code, _description, url, mainFrame) => {
    if (unreachable(code, mainFrame)) {
      window.loadURL(offlinePage(url));
    }
  });

  const file = pending ?? fileIn(process.argv);
  if (file) {
    openFile(file);
    return;
  }
  window.loadURL(hosted.href);
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
    if (file) {
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
    if (!window) {
      earlyLink.keep(url);
      return;
    }
    follow(url);
  });

  app.whenReady().then(() => {
    installNativeCanvas();
    installMenu();
    saveDownloadsWithDialog();
    open();
    if (app.isPackaged) {
      watchUpdates({ fetch, current: app.getVersion(), ask: (options) => dialog.showMessageBox(window, options), open: (url) => shell.openExternal(url), every: setInterval });
    }
    const deep = earlyLink.take() ?? deepLinkIn(process.argv);
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
    stopServer().finally(() => app.quit());
  });
}
