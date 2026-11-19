import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import * as vscode from 'vscode';
import type { LiveEditAsk } from '@feega/live-edit/live-ask';
import { ToHost, ToView, type HostMessage, type Pick, type Source, type ViewMessage } from '../messages';
import { startDev, type Running } from './dev-server';
import { fileEdits, type Written } from './file-edits';
import { panelHtml } from './panel-html';

const VIEW_TYPE = 'feegaInspect.panel';
const TITLE = 'Feega Inspect';
const PICK_TIMEOUT_MS = 3000;

type Session = { panel: vscode.WebviewPanel; running: Running | null; edits: ReturnType<typeof fileEdits>; root: string };

let session: Session | null = null;
const picks = new Map<number, (pick: Pick | null) => void>();
let nextPick = 0;

const post = (message: ViewMessage) => session?.panel.webview.postMessage(message);

async function openSource(root: string, at: Source) {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(join(root, at.file)));
  const position = new vscode.Position(at.line - 1, Math.max(0, at.col - 1));
  await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, selection: new vscode.Range(position, position) });
}

async function edited(out: Written) {
  await post(out.ok ? { kind: ToView.Edited, ok: true, written: out.written } : { kind: ToView.Edited, ok: false, reason: out.reason });
  return out;
}

async function onMessage(message: HostMessage) {
  if (!session) {
    return;
  }
  const handlers: { [K in ToHost]: (m: Extract<HostMessage, { kind: K }>) => unknown } = {
    [ToHost.Ready]: () => session?.running && post({ kind: ToView.App, url: session.running.url }),
    [ToHost.Edit]: (m) => session!.edits.edit(m.ask).then(edited),
    [ToHost.Undo]: () => session!.edits.undo().then(edited),
    [ToHost.Open]: (m) => openSource(session!.root, m.at),
    [ToHost.Picked]: (m) => (picks.get(m.id)?.(m.pick), picks.delete(m.id))
  };
  (handlers[message.kind] as (m: HostMessage) => unknown)(message);
}

function panelOf(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const media = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
  const panel = vscode.window.createWebviewPanel(VIEW_TYPE, TITLE, vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] });
  const asset = (name: string) => panel.webview.asWebviewUri(vscode.Uri.joinPath(media, name)).toString();
  panel.webview.html = panelHtml({ script: asset('panel.js'), style: asset('panel.css'), cspSource: panel.webview.cspSource, nonce: randomBytes(16).toString('base64') });
  return panel;
}

async function open(context: vscode.ExtensionContext, output: vscode.OutputChannel) {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showWarningMessage('Feega Inspect: open the folder of a web app first.');
    return;
  }
  if (session) {
    session.panel.reveal();
    return;
  }

  const root = folder.uri.fsPath;
  const panel = panelOf(context);
  session = { panel, running: null, edits: fileEdits(root), root };
  panel.webview.onDidReceiveMessage(onMessage);
  panel.onDidDispose(() => {
    session?.running?.stop();
    session = null;
  });

  post({ kind: ToView.Status, text: 'Starting the dev server…' });
  const running = await startDev(root, join(context.extensionPath, 'dist', 'launcher'), (line) => output.append(line));
  if ('refused' in running) {
    post({ kind: ToView.Status, text: running.refused });
    return;
  }
  if (session) {
    session.running = running;
  }
  post({ kind: ToView.App, url: running.url });
}

function pick(x: number, y: number): Promise<Pick | null> {
  const id = ++nextPick;
  return new Promise((resolve) => {
    picks.set(id, resolve);
    setTimeout(() => (picks.delete(id), resolve(null)), PICK_TIMEOUT_MS);
    post({ kind: ToView.Pick, id, x, y });
  });
}

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel(TITLE);
  context.subscriptions.push(output, vscode.commands.registerCommand('feegaInspect.open', () => open(context, output)));

  return {
    url: () => session?.running?.url ?? null,
    pick,
    edit: (ask: LiveEditAsk) => session?.edits.edit(ask).then(edited) ?? null,
    undo: () => session?.edits.undo().then(edited) ?? null
  };
}

export function deactivate() {
  session?.running?.stop();
}
