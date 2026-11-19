import { randomBytes } from 'node:crypto';
import { access, readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import * as vscode from 'vscode';
import type { EditAsk } from '../messages';
import { chosenApp, type Tree } from './app-root';
import { Command } from './commands';
import { devReload } from './dev-reload';
import { panelHtml } from './panel-html';
import { routeOfFile } from './page-route';
import { inspectSession, type Session } from './session';
import { beforeProvider, vsCodePlatform, type VsCodeHost } from './vscode-platform';

const VIEW_TYPE = 'feegaInspect.panel';
const TITLE = 'Feega Inspect';
const SECTION = 'feegaInspect';

type Open = { panel: vscode.WebviewPanel; session: Session };

let opened: Open | null = null;
let host: VsCodeHost | null = null;
const befores = new Map<string, string>();

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

const tree: Tree = {
  has: (path) => access(path).then(() => true, () => false),
  dirs: (path) => readdir(path, { withFileTypes: true }).then((all) => all.filter((e) => e.isDirectory()).map((e) => e.name), () => [])
};

async function chosenRoot(target?: vscode.Uri): Promise<string | null> {
  const folder = (target && vscode.workspace.getWorkspaceFolder(target)) ?? vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return null;
  }
  const workspace = folder.uri.fsPath;
  return chosenApp(target?.fsPath ?? workspace, workspace, tree, async (apps) => {
    const picked = await vscode.window.showQuickPick(apps, { placeHolder: 'Which app should Feega Inspect open?' });
    return picked?.app ?? null;
  });
}

async function open(context: vscode.ExtensionContext, target?: vscode.Uri) {
  const root = await chosenRoot(target);
  if (!root || !host) {
    vscode.window.showWarningMessage('Feega Inspect: open the folder of a web app first.');
    return;
  }
  const route = target ? (routeOfFile(relative(root, target.fsPath)) ?? undefined) : undefined;
  if (opened && opened.session.root === root) {
    opened.panel.reveal();
    await opened.session.showRoute(route);
    return;
  }
  if (opened) {
    const SWITCH = 'Switch';
    const answer = await vscode.window.showInformationMessage(`Feega Inspect is open on ${basename(opened.session.root)}. Switch to ${basename(root)}?`, { modal: true }, SWITCH);
    if (answer !== SWITCH) {
      opened.panel.reveal();
      return;
    }
    opened.panel.dispose();
  }

  const panel = panelOf(context);
  const session = inspectSession(vsCodePlatform(host, panel, befores), root, route);
  opened = { panel, session };
  panel.onDidDispose(() => {
    session.stop();
    opened = null;
  });
  await session.start();
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel(`${TITLE}: dev server`);
  host = { context, output, launcher: join(context.extensionPath, 'dist', 'launcher') };
  context.subscriptions.push(
    output,
    ...Object.values(Command).map((id) => vscode.commands.registerCommand(id, (target?: vscode.Uri) => open(context, target))),
    vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration(SECTION) && opened?.session.settingsChanged()),
    beforeProvider(befores)
  );
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

export function deactivate() {
  opened?.session.stop();
}
