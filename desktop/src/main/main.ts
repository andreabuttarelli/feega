import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { accountStore } from './account';
import { settingsStore } from './store';
import { tabHost } from './tabs';
import { Channel, type ShellState } from './types';

const DEFAULT_SIZE = { width: 1440, height: 900 };
const BACKGROUND = '#000000';
const TRAFFIC_LIGHTS = { x: 14, y: 14 };
const SCRIPT_ENV = 'FEEGA_DESKTOP_SCRIPT';

app.whenReady().then(() => {
  const userData = app.getPath('userData');
  const settings = settingsStore(userData);
  const account = accountStore(userData);

  const window = new BrowserWindow({
    ...DEFAULT_SIZE,
    backgroundColor: BACKGROUND,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: TRAFFIC_LIGHTS,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true }
  });

  const state = (): ShellState => ({
    tabs: tabs.list(),
    active: tabs.active(),
    email: account.email(),
    skipped: settings.get().skipped,
    recents: settings.get().recents
  });

  const publish = () => window.webContents.send(Channel.State, state());
  const tabs = tabHost(window, publish);

  const openDir = async (dir: string) => {
    settings.visit(dir);
    await tabs.open(dir);
  };

  ipcMain.handle(Channel.GetState, state);
  ipcMain.handle(Channel.SignIn, async () => {
    await account.start();
    publish();
  });
  ipcMain.handle(Channel.SignOut, () => {
    account.clear();
    settings.unskip();
    publish();
  });
  ipcMain.handle(Channel.Skip, () => {
    settings.skip();
    publish();
  });
  ipcMain.handle(Channel.PickFolder, async () => {
    const picked = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
    if (!picked.canceled && picked.filePaths[0]) {
      await openDir(picked.filePaths[0]);
    }
  });
  ipcMain.handle(Channel.OpenDir, (_event, dir: string) => openDir(dir));
  ipcMain.handle(Channel.CloseTab, (_event, id: string) => tabs.close(id));
  ipcMain.handle(Channel.Activate, (_event, id: string | null) => tabs.activate(id));

  void window.loadFile(join(__dirname, 'renderer', 'index.html'));

  const script = process.env[SCRIPT_ENV];
  if (script) {
    void import(script).then((loaded) => loaded.default({ window, openDir, tabs, settings }));
  }

  let closing = false;
  app.on('before-quit', (event) => {
    if (closing) {
      return;
    }
    event.preventDefault();
    closing = true;
    void tabs.closeAll().finally(() => app.exit(0));
  });
});

app.on('window-all-closed', () => app.quit());
