import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { liveAtOf } from '@feega/live-edit/live-ask';
import { ServerAction, ServerState, ToHost, ToView, type EditAsk, type HostMessage, type Pick, type Prefs, type Source, type ViewMessage } from '../messages';
import { rm } from 'node:fs/promises';
import { Attach, startDev, type Running } from './dev-server';
import { fileEdits, type Written } from './file-edits';
import { panelHtml } from './panel-html';
import { devReload } from './dev-reload';
import { stylingOf } from './styling';
import { SETTINGS, SettingKey, StylingChoice, type Settings } from '../settings';

const VIEW_TYPE = 'feegaInspect.panel';
const TITLE = 'Feega Inspect';
const PICK_TIMEOUT_MS = 3000;
const PREFS_KEY = 'feegaInspect.prefs';
const HISTORY_KEY = 'feegaInspect.history';
const BEFORE_SCHEME = 'feega-before';
const LATER_EDITS = 'later edits depend on this change: undo them first';

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

async function postHistory() {
  if (!session || !host) {
    return;
  }
  await host.context.workspaceState.update(HISTORY_KEY, session.edits.snapshot());
  await post({ kind: ToView.History, changes: session.edits.history(), canUndo: session.edits.canUndo(), canRedo: session.edits.canRedo() });
}

const befores = new Map<string, string>();

async function showDiff(id: number) {
  const [first] = session?.edits.beforeOf(id) ?? [];
  if (!first) {
    return;
  }
  const key = `${id}${first.full}`;
  befores.set(key, first.before);
  const left = vscode.Uri.from({ scheme: BEFORE_SCHEME, path: first.full, query: key });
  await vscode.commands.executeCommand('vscode.diff', left, vscode.Uri.file(first.full), `${first.full.split('/').pop()} (before ↔ now)`);
}

async function revert(id: number | null) {
  if (!session) {
    return;
  }
  if (id === null) {
    while (session.edits.canUndo() && (await session.edits.undo()).ok) {
      await postHistory();
    }
    await postHistory();
    return;
  }
  if (session.edits.latest() !== id) {
    await post({ kind: ToView.Edited, ok: false, reason: LATER_EDITS });
    return;
  }
  await edited(await session.edits.undo(), null);
}

async function edited(out: Written, ask: EditAsk | null) {
  await postHistory();
  const saved = ask ? (liveAtOf(ask.at) ?? undefined) : undefined;
  await post(out.ok ? { kind: ToView.Edited, ok: true, written: out.written, saved, note: out.note } : { kind: ToView.Edited, ok: false, reason: out.reason, at: out.at });
  return out;
}

const edit = (ask: EditAsk) => session?.edits.edit(ask).then((out) => edited(out, ask)) ?? null;

async function showApp() {
  if (!session?.running || !host) {
    return;
  }
  const prefs = host.context.workspaceState.get<Prefs>(PREFS_KEY) ?? null;
  await post({ kind: ToView.App, url: session.running.url, styling: await stylingOf(session.root, stylingChoice()), prefs });
  await post({ kind: ToView.Server, state: ServerState.Running, info: infoOf(session.running) });
  await postSettings();
}

const CACHE_DIRS = ['.svelte-kit', 'node_modules/.vite', '.next', '.nuxt', '.astro'];
const ERROR_LINES = 6;
const ERROR = /error|failed|cannot|exception/i;

let lastError = '';
let startedAt = 0;

function infoOf(running: Running) {
  return {
    url: running.url,
    framework: running.plan.framework,
    command: running.command,
    pid: running.pid,
    port: Number(new URL(running.url).port),
    attached: running.attached,
    startedAt,
    lastError
  };
}

function logLine(output: vscode.OutputChannel, line: string) {
  output.append(line);
  if (ERROR.test(line)) {
    lastError = [...lastError.split('\n'), ...line.trim().split('\n')].slice(-ERROR_LINES).join('\n');
  }
}

async function startServer(attach = Attach.IfRunning) {
  if (!session || !host) {
    return;
  }
  session.running?.stop();
  lastError = '';
  post({ kind: ToView.Server, state: ServerState.Starting });
  const output = host.output;
  const running = await startDev(session.root, join(host.context.extensionPath, 'dist', 'launcher'), (line) => logLine(output, line), String(settingsNow()[SettingKey.DevCommand]), attach);
  if ('refused' in running) {
    post({ kind: ToView.Server, state: ServerState.Stopped, reason: running.refused });
    return;
  }
  startedAt = Date.now();
  if (session) {
    session.running = running;
    running.exited(() => post({ kind: ToView.Server, state: ServerState.Stopped, reason: lastError || 'the dev server exited', info: infoOf(running) }));
  }
  await showApp();
}

function stopServer() {
  const running = session?.running;
  running?.stop();
  if (session) {
    session.running = null;
  }
  post({ kind: ToView.Server, state: ServerState.Stopped, reason: 'stopped' });
}

async function clearCache() {
  if (!session) {
    return;
  }
  const yes = 'Clear and restart';
  const answer = await vscode.window.showWarningMessage(`Delete ${CACHE_DIRS.join(', ')} in this app and restart the dev server?`, { modal: true }, yes);
  if (answer !== yes) {
    return;
  }
  const appRoot = join(session.root, session.running?.plan.appDir ?? '');
  session.running?.stop();
  await Promise.all(CACHE_DIRS.map((dir) => rm(join(appRoot, dir), { recursive: true, force: true })));
  await startServer();
}

const SERVER_ACTIONS: Record<ServerAction, () => unknown> = {
  [ServerAction.Start]: () => startServer(),
  [ServerAction.Restart]: () => startServer(),
  [ServerAction.Stop]: stopServer,
  [ServerAction.ReloadPage]: () => showApp(),
  [ServerAction.ClearCache]: clearCache,
  [ServerAction.ShowLogs]: () => host?.output.show(true),
  [ServerAction.ChangeCommand]: () => vscode.commands.executeCommand('workbench.action.openSettings', SettingKey.DevCommand),
  [ServerAction.RestartUnderFeega]: () => startServer(Attach.Never)
};

async function onMessage(message: HostMessage) {
  if (!session) {
    return;
  }
  const handlers: { [K in ToHost]: (m: Extract<HostMessage, { kind: K }>) => unknown } = {
    [ToHost.Ready]: () => (showApp(), postSettings(), postHistory()),
    [ToHost.Edit]: (m) => edit(m.ask),
    [ToHost.Undo]: () => session!.edits.undo().then((out) => edited(out, null)),
    [ToHost.Open]: (m) => openSource(session!.root, m.at),
    [ToHost.Picked]: (m) => (picks.get(m.id)?.(m.pick), picks.delete(m.id)),
    [ToHost.Restart]: () => startServer(),
    [ToHost.External]: (m) => vscode.env.openExternal(vscode.Uri.parse(m.url)),
    [ToHost.Prefs]: (m) => host?.context.workspaceState.update(PREFS_KEY, m.prefs),
    [ToHost.Server]: (m) => SERVER_ACTIONS[m.action](),
    [ToHost.Redo]: () => session!.edits.redo().then((out) => edited(out, null)),
    [ToHost.Revert]: (m) => revert(m.id),
    [ToHost.Diff]: (m) => showDiff(m.id),
    [ToHost.SourceControl]: () => vscode.commands.executeCommand('workbench.view.scm'),
    [ToHost.Move]: (m) => session!.edits.move(m.from, m.to, m.place).then((out) => edited(out, null)),
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
  session = { panel, running: null, edits: fileEdits(root, stylingChoice, context.workspaceState.get(HISTORY_KEY)), root };
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
  const output = vscode.window.createOutputChannel(`${TITLE}: dev server`);
  host = { context, output };
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('feegaInspect.open', () => open(context)),
    vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration(SECTION) && postSettings())
  );
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(BEFORE_SCHEME, { provideTextDocumentContent: (uri) => befores.get(uri.query) ?? '' }));
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
