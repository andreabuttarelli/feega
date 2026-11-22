import { basename } from 'node:path';
import * as vscode from 'vscode';
import type { HostMessage, Source } from '../messages';
import { SettingKey, settingsWith } from '../settings';
import { Column, openTarget, revealColumn } from './open-source';
import type { Account, AccountStore } from './account';
import { IMAGE_EXTENSIONS } from './image-copy';
import { deviceOnboardingStore, globalStateOnboardingStore } from './onboarding';
import type { Platform } from './platform';
import { Device, editorOf, globalStateInstallStore, installIdOf, type UsageHost } from './usage';

const BEFORE_SCHEME = 'feega-before';

const COLUMNS: Record<Column, vscode.ViewColumn> = { [Column.First]: vscode.ViewColumn.One, [Column.Beside]: vscode.ViewColumn.Beside };

const SECRET_KEY = 'feegaInspect.account';

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
    installId: installIdOf(globalStateInstallStore(context.globalState)),
    version: String(context.extension.packageJSON.version),
    editor: editorOf(vscode.env.appName),
    os: process.platform,
    arch: process.arch,
    device: vscode.env.uiKind === vscode.UIKind.Web ? Device.Web : Device.Desktop
  }),
  enabled: () => vscode.env.isTelemetryEnabled && config().get(SettingKey.Telemetry, true) === true
});

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
    confirm: async (question, yes) => (await vscode.window.showWarningMessage(question, { modal: true }, yes)) === yes,
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
    account: secretAccountStore(context.secrets),
    onboarding: deviceOnboardingStore(globalStateOnboardingStore(context.globalState)),
    usage: vsCodeUsage(context)
  };
}

export const beforeProvider = (befores: Map<string, string>) =>
  vscode.workspace.registerTextDocumentContentProvider(BEFORE_SCHEME, { provideTextDocumentContent: (uri) => befores.get(uri.query) ?? '' });
