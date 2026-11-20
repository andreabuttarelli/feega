import { basename } from 'node:path';
import * as vscode from 'vscode';
import type { HostMessage, Source } from '../messages';
import { settingsWith } from '../settings';
import { Column, openTarget } from './open-source';
import type { Account, AccountStore } from './account';
import { globalStateOnboardingStore } from './onboarding';
import type { Platform } from './platform';

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

  async function showDiff(path: string, before: string) {
    const key = `${befores.size}${path}`;
    befores.set(key, before);
    const left = vscode.Uri.from({ scheme: BEFORE_SCHEME, path, query: key });
    await vscode.commands.executeCommand('vscode.diff', left, vscode.Uri.file(path), `${path.split('/').pop()} (before ↔ now)`);
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
    account: secretAccountStore(context.secrets),
    onboarding: globalStateOnboardingStore(context.globalState)
  };
}

export const beforeProvider = (befores: Map<string, string>) =>
  vscode.workspace.registerTextDocumentContentProvider(BEFORE_SCHEME, { provideTextDocumentContent: (uri) => befores.get(uri.query) ?? '' });
