import { publishLocal } from './local-bridge/publish';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import * as vscode from 'vscode';
import type { HostMessage, Source } from '../messages';
import { SettingKey, settingsWith } from '../settings';
import { Column, openTarget, revealColumn } from './open-source';
import { accountToken, type Account, type AccountStore } from './account';
import { cloudApi } from './cloud-api';
import { IMAGE_EXTENSIONS } from './image-copy';
import { catalogFile } from './library';
import { pluginsRoot } from '@feega/plugin-store/registry';
import { deviceOnboardingStore, globalStateOnboardingStore } from './onboarding';
import { globalStateSupportStore } from './support';
import { WATCHED, relativeOf, type Watch } from './file-watch';
import type { Platform } from './platform';
import { HintSurface, nodeHintFs } from './skill-hint';
import { automated, Device, editorOf, globalStateFirstEdit, globalStateInstallStore, installOf, optedOut, type UsageHost } from './usage';

const BEFORE_SCHEME = 'feega-before';

const COLUMNS: Record<Column, vscode.ViewColumn> = { [Column.First]: vscode.ViewColumn.One, [Column.Beside]: vscode.ViewColumn.Beside };

const WEB_URL_VAR = 'FEEGA_WEB_URL';
const SECRET_KEY = 'feegaInspect.account';
const SKILL_HINT_NEVER = 'feegaInspect.skillHintNever';

export const DEV_PLUGINS_SETTING = 'feegaInspect.plugins.dev';

export const approveInModal = async (question: string, yes: string) => (await vscode.window.showWarningMessage(question, { modal: true }, yes)) === yes;

const config = () => vscode.workspace.getConfiguration();

export type VsCodeHost = { context: vscode.ExtensionContext; output: vscode.OutputChannel; launcher: string };

export type PanelLike = Pick<vscode.WebviewPanel, 'viewColumn'> & { webview: Pick<vscode.Webview, 'postMessage' | 'onDidReceiveMessage'> };

export const secretAccountStore = (secrets: Pick<vscode.SecretStorage, 'get' | 'store' | 'delete'>): AccountStore => ({
  read: async () => {
    const raw = await secrets.get(SECRET_KEY);
    try {
      return raw ? (JSON.parse(raw) as Account) : null;
    } catch {
      return null;
    }
  },
  write: (account) => Promise.resolve(secrets.store(SECRET_KEY, JSON.stringify(account))),
  clear: () => Promise.resolve(secrets.delete(SECRET_KEY))
});

export const vsCodeUsage = (context: vscode.ExtensionContext): UsageHost => ({
  identity: () => ({
    ...installOf(globalStateInstallStore(context.globalState)),
    version: String(context.extension.packageJSON.version),
    editor: editorOf(vscode.env.appName),
    os: process.platform,
    arch: process.arch,
    device: vscode.env.uiKind === vscode.UIKind.Web ? Device.Web : Device.Desktop
  }),
  enabled: () =>
    !automated(process.env) && !optedOut(process.env) && context.extensionMode !== vscode.ExtensionMode.Test && vscode.env.isTelemetryEnabled && config().get(SettingKey.Telemetry, true) === true,
  firstEdit: globalStateFirstEdit(context.globalState)
});

export const vsCodeWatch: Watch = (root, changed) => {
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, '**/*'));
  const seen = (uri: vscode.Uri) => {
    if (WATCHED(relativeOf(root, uri.fsPath))) {
      changed();
    }
  };
  const subscriptions = [watcher.onDidCreate(seen), watcher.onDidChange(seen), watcher.onDidDelete(seen)];
  return { dispose: () => [...subscriptions, watcher].forEach((d) => d.dispose()) };
};

export function vsCodePlatform(host: VsCodeHost, panel: PanelLike, befores: Map<string, string>): Platform {
  const { context, output } = host;

  async function openSource(root: string, at: Source) {
    const target = openTarget(root, at, panel.viewColumn);
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target.path));
      const position = new vscode.Position(target.line, target.col);
      await vscode.window.showTextDocument(doc, { viewColumn: COLUMNS[target.column], preserveFocus: false, selection: new vscode.Range(position, position) });
    } catch {
      void vscode.window.showErrorMessage(`Feega: cannot open ${target.path}`);
    }
  }

  async function revealSource(root: string, at: Source) {
    const column = revealColumn(panel.viewColumn, vscode.window.tabGroups.all.map((group) => group.viewColumn));
    if (column === null) {
      return;
    }
    const target = openTarget(root, at, panel.viewColumn);
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target.path));
      const start = new vscode.Position(target.line, target.col);
      const end = new vscode.Position(target.line, Number.MAX_SAFE_INTEGER);
      await vscode.window.showTextDocument(doc, { viewColumn: column, preserveFocus: true, preview: true, selection: new vscode.Range(start, end) });
    } catch {
      return;
    }
  }

  async function showDiff(path: string, before: string) {
    const key = `${befores.size}${path}`;
    befores.set(key, before);
    const left = vscode.Uri.from({ scheme: BEFORE_SCHEME, path, query: key });
    await vscode.commands.executeCommand('vscode.diff', left, vscode.Uri.file(path), `${path.split('/').pop()} (before ↔ now)`);
  }

  async function pickImage() {
    const [uri] = (await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: 'Use image', filters: { Images: IMAGE_EXTENSIONS } })) ?? [];
    return uri ? { name: basename(uri.fsPath), bytes: await vscode.workspace.fs.readFile(uri) } : null;
  }

  const account = secretAccountStore(context.secrets);

  return {
    version: String(context.extension.packageJSON.version),
    launcher: host.launcher,
    send: (message) => panel.webview.postMessage(message),
    receive: (handle) => void panel.webview.onDidReceiveMessage((message: HostMessage) => handle(message)),
    settings: () => settingsWith((row) => config().get(row.key, row.fallback)),
    setSetting: async (key, value) => config().update(key, value, vscode.ConfigurationTarget.Global),
    stored: (key) => context.workspaceState.get(key),
    store: async (key, value) => context.workspaceState.update(key, value),
    log: (line) => output.append(line),
    showLogs: () => output.show(true),
    openSource,
    copyText: async (text) => vscode.env.clipboard.writeText(text),
    revealSource,
    showDiff,
    confirm: approveInModal,
    chooseApp: async (apps, workspace) => {
      const items = apps.map((app) => ({ label: app || basename(workspace), description: app || 'workspace root', app }));
      return (await vscode.window.showQuickPick(items, { placeHolder: 'Which app should Feega open?' }))?.app ?? null;
    },
    openExternal: (url) => vscode.env.openExternal(vscode.Uri.parse(url)),
    openSettings: (key) => vscode.commands.executeCommand('workbench.action.openSettings', key),
    sourceControl: () => vscode.commands.executeCommand('workbench.view.scm'),
    notify: (text) => vscode.window.showInformationMessage(`Feega: ${text}`),
    warn: async (text, action) => (await vscode.window.showWarningMessage(`Feega: ${text}`, ...(action ? [action] : []))) === action,
    pickImage,
    library: catalogFile(join(dirname(host.launcher), 'library.json')),
    watchFiles: vsCodeWatch,
    proFiles: (id, framework) => cloudApi({ base: process.env[WEB_URL_VAR], token: () => accountToken(account) }).libraryPro(id, framework),
    account,
    onboarding: deviceOnboardingStore(globalStateOnboardingStore(context.globalState)),
    support: globalStateSupportStore(context.globalState),
    localBridge: publishLocal,
    usage: vsCodeUsage(context),
    skillHint: { fs: nodeHintFs, home: homedir(), surface: HintSurface.Panel, never: () => context.globalState.get(SKILL_HINT_NEVER) === true, setNever: async () => context.globalState.update(SKILL_HINT_NEVER, true) },
    plugins: { root: pluginsRoot(), dev: () => config().get<string[]>(DEV_PLUGINS_SETTING, []), approve: approveInModal }
  };
}

export const beforeProvider = (befores: Map<string, string>) =>
  vscode.workspace.registerTextDocumentContentProvider(BEFORE_SCHEME, { provideTextDocumentContent: (uri) => befores.get(uri.query) ?? '' });
