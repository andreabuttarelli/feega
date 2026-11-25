import { BrowserWindow, app, dialog, ipcMain, nativeImage, nativeTheme, shell } from 'electron';
import { basename, join, resolve } from 'node:path';
import { accountStore } from './account';
import { SCHEME, acceptDeepLink, linkOfArgv } from './deep-link';
import { LINKS } from './links';
import { installMenu } from './menu';
import { pidFile } from './pid-file';
import { frameworkOf } from './project-info';
import { inviteWanted, settingsStore } from './store';
import { tabHost } from './tabs';
import { updateController } from './updates/controller';
import pkg from '../../package.json';
import { platformRow } from './platform';
import { Channel, NodeStatus, type Link, type NodeState, type Preferences, type ProjectState, type ShellState } from './types';
import { readLoginPath, runShell } from './login-path';
import { checkNode, runTool } from './node-check';
import { bundledDir } from './cli-process';
import { catalogAt, nodePorts, projectCreator, type NewProjectAsk } from './project-creator';

const DEFAULT_SIZE = { width: 1440, height: 900 };
const MIN_SIZE = { minWidth: 900, minHeight: 600 };
const APP_NAME = 'Feega';
const WEBSITE = 'https://feega.app';
const ICON_PATH = join(__dirname, '..', 'build', 'icons', 'icon.png');

app.setName(APP_NAME);

const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) {
  app.quit();
}

if (process.defaultApp && process.argv[1]) {
  app.setAsDefaultProtocolClient(SCHEME, process.execPath, [resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(SCHEME);
}

const queuedLinks: string[] = [];
let deliverLink: ((url: string) => void) | null = null;
const onLink = (url: string) => (deliverLink ? deliverLink(url) : queuedLinks.push(url));

app.on('open-url', (event, url) => {
  event.preventDefault();
  onLink(url);
});

app.on('second-instance', (_event, argv) => {
  const link = linkOfArgv(argv);
  if (link) {
    onLink(link);
  }
});
app.setAboutPanelOptions({ applicationName: APP_NAME, applicationVersion: pkg.version, copyright: 'Copyright 2026 Feega', website: WEBSITE, iconPath: ICON_PATH });

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  const icon = nativeImage.createFromPath(ICON_PATH);
  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon);
  }
  const userData = app.getPath('userData');
  const settings = settingsStore(userData);
  const account = accountStore(userData);
  const pids = pidFile(userData);
  pids.sweep();

  const window = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...MIN_SIZE,
    ...platformRow(process.platform).chrome,
    title: APP_NAME,
    icon,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true }
  });

  let node: NodeState = { status: NodeStatus.Checking, message: '' };
  let project: ProjectState | null = null;

  const state = (): ShellState => ({
    tabs: tabs.list(),
    active: tabs.active(),
    email: account.email(),
    signingIn: account.waiting(),
    skipped: settings.get().skipped,
    recents: settings.get().recents.map(({ dir, at }) => ({ dir, at, name: basename(dir), framework: frameworkOf(dir) })),
    preferences: settings.get().preferences,
    update: updates.info(),
    node,
    project,
    invite: inviteWanted(settings.get(), account.email()),
    documents: app.getPath('documents')
  });

  const publish = () => window.webContents.send(Channel.State, state());
  const updates = updateController({
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    userData,
    execPath: process.execPath,
    pid: process.pid,
    isPackaged: app.isPackaged,
    env: process.env,
    enabled: () => settings.get().preferences.automaticUpdates,
    changed: () => publish(),
    quit: () => app.quit()
  });
  const tabs = tabHost(window, publish, pids, {
    options: () => ({ editorPort: settings.get().preferences.editorPort, telemetry: settings.get().preferences.telemetry, cloud: settings.get().preferences.cloud }),
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
  const menu = () => installMenu({ showSettings: () => window.webContents.send(Channel.ShowSettings), checkUpdates: () => void updates.check(true), cloud: settings.get().preferences.cloud, setCloud });
  const setCloud = (on: boolean) => {
    settings.prefer({ cloud: on });
    menu();
    publish();
  };
  ipcMain.handle(Channel.SetPreferences, (_event, change: Partial<Preferences>) => {
    settings.prefer(change);
    menu();
    publish();
  });
  const create = projectCreator(() => catalogAt(bundledDir()), nodePorts(), (progress) => {
    project = progress ? { name: progress.name, step: progress.step, line: progress.line, error: '' } : null;
    publish();
  });
  ipcMain.handle(Channel.PickParent, async () => {
    const picked = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'], defaultPath: app.getPath('documents') });
    return picked.canceled ? null : (picked.filePaths[0] ?? null);
  });
  ipcMain.handle(Channel.CreateProject, async (_event, ask: NewProjectAsk) => {
    const out = await create(ask);
    if (!out.ok) {
      project = { name: ask.name, step: 'failed', line: '', error: out.reason };
      publish();
      return;
    }
    project = null;
    settings.created();
    openDir(out.dir);
  });
  ipcMain.handle(Channel.ClearProject, () => {
    project = null;
    publish();
  });
  ipcMain.handle(Channel.DismissInvite, () => {
    settings.dismissInvite();
    publish();
  });
  const checkRuntime = async () => {
    node = { status: NodeStatus.Checking, message: '' };
    publish();
    const found = await checkNode(runTool);
    node = found.ok ? { status: NodeStatus.Ready, message: found.node } : { status: NodeStatus.Problem, message: found.message };
    publish();
    return found.ok;
  };
  ipcMain.handle(Channel.CheckNode, checkRuntime);
  ipcMain.handle(Channel.OpenLink, (_event, link: Link) => shell.openExternal(LINKS[link]));
  ipcMain.handle(Channel.Overlay, (_event, open: boolean) => tabs.overlay(open));
  ipcMain.handle(Channel.CheckUpdates, () => updates.check(true));
  ipcMain.handle(Channel.InstallUpdate, () => updates.install());
  ipcMain.handle(Channel.Quit, () => app.quit());

  menu();
  updates.start();

  void window.loadFile(join(__dirname, 'renderer', 'index.html'));

  const focusWindow = () => {
    if (window.isMinimized()) {
      window.restore();
    }
    window.show();
    window.focus();
  };

  deliverLink = (url) => {
    if (acceptDeepLink(url)) {
      focusWindow();
    }
  };
  const launchLink = linkOfArgv(process.argv);
  for (const url of [...queuedLinks.splice(0), ...(launchLink ? [launchLink] : [])]) {
    deliverLink(url);
  }

  const reopenLast = () => {
    const wanted = settings.get().preferences.reopenOnLaunch && (account.email() !== null || settings.get().skipped);
    for (const dir of wanted ? settings.get().openDirs : []) {
      void tabs.open(dir);
    }
  };
  window.webContents.once('did-finish-load', () => {
    void readLoginPath({ platform: process.platform, env: process.env, run: runShell })
      .then(checkRuntime)
      .then((ready) => ready && reopenLast());
  });

  let closing = false;
  app.on('before-quit', (event) => {
    if (closing) {
      return;
    }
    event.preventDefault();
    closing = true;
    void tabs
      .closeAll()
      .then(() => updates.applyOnQuit())
      .finally(() => app.exit(0));
  });
});

app.on('window-all-closed', () => app.quit());
