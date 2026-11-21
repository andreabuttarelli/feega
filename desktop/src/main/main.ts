import { BrowserWindow, app, dialog, ipcMain, nativeTheme, shell, type BrowserWindowConstructorOptions } from 'electron';
import { basename, join } from 'node:path';
import { accountStore } from './account';
import { LINKS } from './links';
import { installMenu } from './menu';
import { pidFile } from './pid-file';
import { frameworkOf } from './project-info';
import { settingsStore } from './store';
import { tabHost } from './tabs';
import { Channel, type Link, type Preferences, type ShellState } from './types';

const DEFAULT_SIZE = { width: 1440, height: 900 };
const MIN_SIZE = { minWidth: 900, minHeight: 600 };
const SOLID_BACKGROUND = '#121212';
const TRANSPARENT = '#00000000';
const VIBRANCY = 'under-window';

const surface = (): BrowserWindowConstructorOptions =>
  process.platform === 'darwin' ? { vibrancy: VIBRANCY, visualEffectState: 'active', backgroundColor: TRANSPARENT } : { backgroundColor: SOLID_BACKGROUND };
const TRAFFIC_LIGHTS = { x: 18, y: 20 };

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  const userData = app.getPath('userData');
  const settings = settingsStore(userData);
  const account = accountStore(userData);
  const pids = pidFile(userData);
  pids.sweep();

  const window = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...MIN_SIZE,
    ...surface(),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: TRAFFIC_LIGHTS,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true }
  });

  const state = (): ShellState => ({
    tabs: tabs.list(),
    active: tabs.active(),
    email: account.email(),
    signingIn: account.waiting(),
    skipped: settings.get().skipped,
    recents: settings.get().recents.map(({ dir, at }) => ({ dir, at, name: basename(dir), framework: frameworkOf(dir) })),
    preferences: settings.get().preferences
  });

  const publish = () => window.webContents.send(Channel.State, state());
  const tabs = tabHost(window, publish, pids, {
    options: () => ({ editorPort: settings.get().preferences.editorPort, telemetry: settings.get().preferences.telemetry }),
    opened: (dirs) => settings.remember(dirs)
  });

  const openDir = (dir: string) => {
    settings.visit(dir);
    void tabs.open(dir);
  };

  ipcMain.handle(Channel.GetState, state);
  ipcMain.handle(Channel.SignIn, async () => {
    await account.start(publish);
    publish();
  });
  ipcMain.handle(Channel.CancelSignIn, () => account.cancel());
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
      openDir(picked.filePaths[0]);
    }
  });
  ipcMain.handle(Channel.OpenDir, (_event, dir: string) => openDir(dir));
  ipcMain.handle(Channel.CloseTab, (_event, id: string) => tabs.close(id));
  ipcMain.handle(Channel.RetryTab, (_event, id: string) => void tabs.retry(id));
  ipcMain.handle(Channel.ChooseApp, (_event, id: string, app: string) => tabs.choose(id, app));
  ipcMain.handle(Channel.Activate, (_event, id: string | null) => tabs.activate(id));
  ipcMain.handle(Channel.SetPreferences, (_event, change: Partial<Preferences>) => {
    settings.prefer(change);
    publish();
  });
  ipcMain.handle(Channel.OpenLink, (_event, link: Link) => shell.openExternal(LINKS[link]));
  ipcMain.handle(Channel.Overlay, (_event, open: boolean) => tabs.overlay(open));
  ipcMain.handle(Channel.Quit, () => app.quit());

  installMenu(() => window.webContents.send(Channel.ShowSettings));

  void window.loadFile(join(__dirname, 'renderer', 'index.html'));

  const reopenLast = () => {
    const wanted = settings.get().preferences.reopenOnLaunch && (account.email() !== null || settings.get().skipped);
    for (const dir of wanted ? settings.get().openDirs : []) {
      void tabs.open(dir);
    }
  };
  window.webContents.once('did-finish-load', reopenLast);

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
