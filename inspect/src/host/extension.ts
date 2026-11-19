import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { liveAtOf } from '@feega/live-edit/live-ask';
import { ServerState, ToHost, ToView, type EditAsk, type HostMessage, type Pick, type Prefs, type Source, type ViewMessage } from '../messages';
import { startDev, type Running } from './dev-server';
import { fileEdits, type Written } from './file-edits';
import { panelHtml } from './panel-html';
import { devReload } from './dev-reload';
import { stylingOf } from './styling';
import { SETTINGS, SettingKey, StylingChoice, type Settings } from '../settings';

const VIEW_TYPE = 'feegaInspect.panel';
const TITLE = 'Feega Inspect';
const PICK_TIMEOUT_MS = 3000;
const PREFS_KEY = 'feegaInspect.prefs';

type Session = { panel: vscode.WebviewPanel; running: Running | null; edits: ReturnType<typeof fileEdits>; root: string };
type Host = { context: vscode.ExtensionContext; output: vscode.OutputChannel };

let session: Session | null = null;
let host: Host | null = null;
const picks = new Map<number, (pick: Pick | null) => void>();
let nextPick = 0;

const post = (message: ViewMessage) => session?.panel.webview.postMessage(message);

const SECTION = 'feegaInspect';
const config = () => vscode.workspace.getConfiguration();
const settingsNow = (): Settings => Object.fromEntries(SETTINGS.map((row) => [row.key, config().get(row.key, row.fallback)])) as Settings;
const stylingChoice = () => settingsNow()[SettingKey.Styling] as StylingChoice;

async function postSettings() {
  if (!session || !host) {
    return;
  }
  const version = String(host.context.extension.packageJSON.version);
  const framework = session.running?.plan.framework ?? 'unknown';
  const styling = await stylingOf(session.root, stylingChoice());
  await post({ kind: ToView.Settings, values: settingsNow(), facts: { version, framework, styling } });
}

async function openSource(root: string, at: Source) {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(join(root, at.file)));
  const position = new vscode.Position(at.line - 1, Math.max(0, at.col - 1));
  await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, selection: new vscode.Range(position, position) });
}

async function edited(out: Written, ask: EditAsk | null) {
  const saved = ask ? (liveAtOf(ask.at) ?? undefined) : undefined;
  await post(out.ok ? { kind: ToView.Edited, ok: true, written: out.written, saved } : { kind: ToView.Edited, ok: false, reason: out.reason, at: out.at });
  return out;
}

const edit = (ask: EditAsk) => session?.edits.edit(ask).then((out) => edited(out, ask)) ?? null;

async function showApp() {
  if (!session?.running || !host) {
    return;
  }
  const prefs = host.context.workspaceState.get<Prefs>(PREFS_KEY) ?? null;
  await post({ kind: ToView.App, url: session.running.url, styling: await stylingOf(session.root, stylingChoice()), prefs });
  await post({ kind: ToView.Server, state: ServerState.Running });
  await postSettings();
}

async function startServer() {
  if (!session || !host) {
    return;
  }
  session.running?.stop();
  post({ kind: ToView.Server, state: ServerState.Starting });
  const output = host.output;
  const running = await startDev(session.root, join(host.context.extensionPath, 'dist', 'launcher'), (line) => output.append(line), String(settingsNow()[SettingKey.DevCommand]));
  if ('refused' in running) {
    post({ kind: ToView.Server, state: ServerState.Stopped, reason: running.refused });
    return;
  }
  if (session) {
    session.running = running;
    running.exited(() => post({ kind: ToView.Server, state: ServerState.Stopped, reason: 'the dev server exited' }));
  }
  await showApp();
}

async function onMessage(message: HostMessage) {
  if (!session) {
    return;
  }
  const handlers: { [K in ToHost]: (m: Extract<HostMessage, { kind: K }>) => unknown } = {
    [ToHost.Ready]: () => (showApp(), postSettings()),
    [ToHost.Edit]: (m) => edit(m.ask),
    [ToHost.Undo]: () => session!.edits.undo().then((out) => edited(out, null)),
    [ToHost.Open]: (m) => openSource(session!.root, m.at),
    [ToHost.Picked]: (m) => (picks.get(m.id)?.(m.pick), picks.delete(m.id)),
    [ToHost.Restart]: startServer,
    [ToHost.External]: (m) => vscode.env.openExternal(vscode.Uri.parse(m.url)),
    [ToHost.Prefs]: (m) => host?.context.workspaceState.update(PREFS_KEY, m.prefs),
    [ToHost.Setting]: (m) => config().update(m.key, m.value, vscode.ConfigurationTarget.Global)
  };
  (handlers[message.kind] as (m: HostMessage) => unknown)(message);
}

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

async function open(context: vscode.ExtensionContext) {
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
  session = { panel, running: null, edits: fileEdits(root, stylingChoice), root };
  panel.webview.onDidReceiveMessage(onMessage);
  panel.onDidDispose(() => {
    session?.running?.stop();
    session = null;
  });
  await startServer();
}

const close = () => session?.panel.dispose();

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
  host = { context, output };
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('feegaInspect.open', () => open(context)),
    vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration(SECTION) && postSettings())
  );
  devReload(context, () => session && render(session.panel, context));

  return {
    url: () => session?.running?.url ?? null,
    pick,
    edit,
    close,
    undo: () => session?.edits.undo().then((out) => edited(out, null)) ?? null,
    change: (row: string, value: string) => post({ kind: ToView.Change, row, value })
  };
}

export function deactivate() {
  session?.running?.stop();
}
