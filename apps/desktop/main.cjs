const { app, BrowserWindow, shell, dialog, nativeTheme } = require('electron');
const { autoUpdater } = require('electron-updater');
const { watchUpdates } = require('./updates.cjs');
const { frameless, overlay } = require('./chrome.cjs');
const { start, authReturn, staysInside, keepInside, DEEP_LINK_SCHEME } = require('./routing.cjs');

const START_URL_ENV = 'FEEGA_URL';
const home = start(process.env[START_URL_ENV]);
const userAgent = (window) => `${window.webContents.getUserAgent()} FeegaNative/${app.getVersion()}`;

let window = null;

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

function open() {
  window = new BrowserWindow({ width: 1440, height: 900, minWidth: 800, minHeight: 600, title: 'Feega', backgroundColor: '#0c0c0c', ...frameless(process.platform, nativeTheme.shouldUseDarkColors) });
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

  window.loadURL(home.href);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME.slice(0, -1));

  app.on('second-instance', (_event, argv) => {
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

  app.whenReady().then(() => {
    open();
    if (app.isPackaged) {
      watchUpdates({ updater: autoUpdater, ask: (options) => dialog.showMessageBox(window, options), every: setInterval });
    }
    const deep = deepLinkIn(process.argv);
    if (deep) {
      follow(deep);
    }
  });

  app.on('window-all-closed', () => app.quit());
}
