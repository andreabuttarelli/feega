import { randomBytes } from 'node:crypto';
import { access, readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import * as vscode from 'vscode';
import type { EditAsk } from '../messages';
import { urlOf } from './attach-url';
import { chosenApp, type Tree } from './app-root';
import { Command } from './commands';
import { devReload } from './dev-reload';
import { panelHtml } from './panel-html';
import { routeOfFile } from './page-route';
import { keptServers } from './kept-servers';
import { killOrphans } from './orphans';
import type { Running } from './dev-server';
import { appOf, inspectSession, type Session } from './session';
import { signInFromUri } from './sign-in';
import { DEV_PLUGINS_SETTING, approveInModal, beforeProvider, vsCodePlatform, type VsCodeHost } from './vscode-platform';
import { CLOUD_SETTING, cloudEnabled } from '../cloud-flag';
import { accountToken } from './account';
import { cloudApi } from './cloud-api';
import { editorServer } from './editor-server';
import type { Platform } from './platform';
import { RELAY_URL } from './share/share-host';
import { cloudShare } from './share/share-port-factory';
import { withRemoteEditor } from './share/remote-editor';
import { httpFetcher } from '@feega/plugin-store/fetcher';
import { installPlugin } from '@feega/plugin-store/install';
import { pluginsRoot } from '@feega/plugin-store/registry';
import { questionOf } from '@feega/plugin-store/review';
import { sourceOf } from '@feega/plugin-store/source';

const VIEW_TYPE = 'feegaInspect.panel';
const TITLE = 'Feega';
const SECTION = 'feegaInspect';
const SIGN_IN_PATH = '/signin';

type Open = { panel: vscode.WebviewPanel; session: Session };

let opened: Open | null = null;
let host: VsCodeHost | null = null;
const befores = new Map<string, string>();
const kept = keptServers<Running>();

const mediaOf = (context: vscode.ExtensionContext) => vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');

function render(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
  const stamp = Date.now();
  const asset = (name: string) => `${panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaOf(context), name))}?v=${stamp}`;
  panel.webview.html = panelHtml({ script: asset('panel.js'), style: asset('panel.css'), cspSource: panel.webview.cspSource, nonce: randomBytes(16).toString('base64') });
}

function panelOf(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(VIEW_TYPE, TITLE, vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [mediaOf(context)] });
  render(panel, context);
  return panel;
}

const WEB_URL_VAR = 'FEEGA_WEB_URL';
const RELAY_URL_VAR = 'FEEGA_RELAY_URL';
const ANY_PORT = 0;

function cloudPlatform(context: vscode.ExtensionContext, base: Platform): { platform: Platform; stopRemote: () => Promise<void> } {
  if (!cloudEnabled({ setting: vscode.workspace.getConfiguration().get<boolean>(CLOUD_SETTING), env: process.env })) {
    return { platform: base, stopRemote: async () => {} };
  }

  const remote = withRemoteEditor(base, () => editorServer(vscode.Uri.joinPath(mediaOf(context)).fsPath, ANY_PORT));
  const token = () => accountToken(base.account);
  const { share, cloud } = cloudShare({ api: cloudApi({ base: process.env[WEB_URL_VAR], token }), relayUrl: process.env[RELAY_URL_VAR] ?? RELAY_URL, send: fetch, editorUrl: remote.editorUrl });
  return { platform: { ...base, ...remote.transport, share, cloud }, stopRemote: remote.stop };
}

const tree: Tree = {
  has: (path) => access(path).then(() => true, () => false),
  dirs: (path) => readdir(path, { withFileTypes: true }).then((all) => all.filter((e) => e.isDirectory()).map((e) => e.name), () => [])
};

const workspaceOf = (target?: vscode.Uri) => ((target && vscode.workspace.getWorkspaceFolder(target)) ?? vscode.workspace.workspaceFolders?.[0])?.uri.fsPath ?? null;

async function chosenRoot(target?: vscode.Uri): Promise<string | null> {
  const folder = (target && vscode.workspace.getWorkspaceFolder(target)) ?? vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return null;
  }
  const workspace = folder.uri.fsPath;
  return chosenApp(target?.fsPath ?? workspace, workspace, tree, async (apps) => {
    const picked = await vscode.window.showQuickPick(apps, { placeHolder: 'Which app should Feega open?' });
    return picked?.app ?? null;
  });
}

async function open(context: vscode.ExtensionContext, target?: vscode.Uri) {
  const root = await chosenRoot(target);
  if (!root || !host) {
    vscode.window.showWarningMessage('Feega: open the folder of a web app first.');
    return;
  }
  const route = target ? (routeOfFile(relative(root, target.fsPath)) ?? undefined) : undefined;
  if (opened && opened.session.root() === root) {
    opened.panel.reveal();
    await opened.session.showRoute(route);
    return;
  }
  if (opened) {
    const SWITCH = 'Switch';
    const answer = await vscode.window.showInformationMessage(`Feega is open on ${basename(opened.session.root())}. Switch to ${basename(root)}?`, { modal: true }, SWITCH);
    if (answer !== SWITCH) {
      opened.panel.reveal();
      return;
    }
    opened.panel.dispose();
  }

  const panel = panelOf(context);
  const { platform, stopRemote } = cloudPlatform(context, vsCodePlatform(host, panel, befores));
  const workspace = workspaceOf(target) ?? root;
  const session = inspectSession(platform, workspace, appOf(platform, workspace, root), route, kept);
  opened = { panel, session };
  panel.onDidDispose(() => {
    session.stop().then(stopRemote);
    opened = null;
  });
  await session.start();
}

async function openFromUrl(context: vscode.ExtensionContext) {
  const workspace = workspaceOf();
  if (!workspace || !host) {
    vscode.window.showWarningMessage('Feega: open the folder of a web app first.');
    return;
  }
  const typed = await vscode.window.showInputBox({ prompt: 'Address of the running dev server', placeHolder: 'http://localhost:5173', validateInput: (text) => (urlOf(text) ? null : 'Enter a web address, e.g. http://localhost:5173') });
  const url = typed && urlOf(typed);
  if (!url) {
    return;
  }
  opened?.panel.dispose();

  const panel = panelOf(context);
  const { platform, stopRemote } = cloudPlatform(context, vsCodePlatform(host, panel, befores));
  const session = inspectSession(platform, workspace, appOf(platform, workspace, workspace), undefined, kept);
  opened = { panel, session };
  panel.onDidDispose(() => {
    session.stop().then(stopRemote);
    opened = null;
  });
  await session.attachUrl(url);
}

async function installPluginFromSource() {
  const source = await vscode.window.showInputBox({ prompt: 'Plugin to install', placeHolder: 'github:owner/repo@v1.0.0 or an npm package name', validateInput: (text) => (sourceOf(text) ? null : 'Use github:owner/repo[@tag] or an npm package name[@version]') });
  if (!source) {
    return;
  }
  const out = await installPlugin({ root: pluginsRoot(), fetch: httpFetcher(), approve: (review) => approveInModal(questionOf(review), 'Install') }, source);
  if (out.ok) {
    vscode.window.showInformationMessage(`Feega: installed ${out.id} ${out.version}`);
    return;
  }
  vscode.window.showErrorMessage(`Feega: ${out.reason}`);
}

const COMMANDS: Record<Command, (context: vscode.ExtensionContext, target?: vscode.Uri) => unknown> = {
  [Command.Open]: open,
  [Command.DesignFolder]: open,
  [Command.DesignPage]: open,
  [Command.OpenFromUrl]: openFromUrl,
  [Command.InstallPlugin]: installPluginFromSource
};

function settingsChanged(e: vscode.ConfigurationChangeEvent) {
  if (e.affectsConfiguration(DEV_PLUGINS_SETTING)) {
    void opened?.session.pluginsChanged();
  }
  if (!e.affectsConfiguration(SECTION)) {
    return;
  }
  opened?.session.settingsChanged();
  opened?.session.usageChanged();
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel(`${TITLE}: dev server`);
  host = { context, output, launcher: join(context.extensionPath, 'dist', 'launcher') };
  context.subscriptions.push(
    output,
    ...Object.values(Command).map((id) => vscode.commands.registerCommand(id, (target?: vscode.Uri) => COMMANDS[id](context, target))),
    vscode.workspace.onDidChangeConfiguration(settingsChanged),
    vscode.window.onDidChangeWindowState((state) => (state.focused ? opened?.session.back() : opened?.session.away())),
    vscode.env.onDidChangeTelemetryEnabled(() => opened?.session.usageChanged()),
    beforeProvider(befores),
    vscode.window.registerUriHandler({ handleUri: (uri) => void (uri.path === SIGN_IN_PATH && signInFromUri(uri.query)) })
  );
  void killOrphans(context.workspaceState);
  devReload(context, () => opened && render(opened.panel, context));

  return {
    url: () => opened?.session.url() ?? null,
    pick: (x: number, y: number) => opened?.session.pick(x, y) ?? Promise.resolve(null),
    edit: (ask: EditAsk) => opened?.session.edit(ask) ?? null,
    close: () => opened?.panel.dispose(),
    undo: () => opened?.session.undo() ?? null,
    change: (row: string, value: string) => opened?.session.change(row, value)
  };
}

export async function deactivate() {
  await opened?.session.stop();
  kept.stopAll();
}
