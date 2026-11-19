const vscode = require('vscode');
const { spawn } = require('node:child_process');
const { existsSync, renameSync, statSync } = require('node:fs');
const { dirname } = require('node:path');
const { DEPRECATION, Launch, launcherOf, legacyMove, mcpServers, canvasPage, eventReader, importMessage, progressOf, advance, failedAt, finishedAll, stepsPage, logTail, spawnOptions, RETRY, localUrl, freePort, readyProbe, served } = require('./canvas-run');

const READY_POLL_MS = 400;
const QUIET_TIMEOUT_MS = 180_000;
const LOG_TAIL_LINES = 40;

const running = new Map();
const attempts = new WeakMap();
const mcpChanged = new vscode.EventEmitter();
const cursorServers = new Map();
const children = new Set();

async function ready(url, launch) {
  while (!launch.ended && Date.now() - launch.lastOutput < QUIET_TIMEOUT_MS) {
    if (await fetch(url, readyProbe).then((r) => served(r.status), () => false)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, READY_POLL_MS));
  }
  return false;
}

function publishMcp() {
  mcpChanged.fire();
  const cursor = vscode.cursor?.mcp;
  if (!cursor) {
    return;
  }

  const wanted = new Map(mcpServers(running).map((s) => [s.label, s]));
  for (const label of cursorServers.keys()) {
    if (!wanted.has(label)) {
      cursor.unregisterServer(label);
      cursorServers.delete(label);
    }
  }
  for (const [label, s] of wanted) {
    if (!cursorServers.has(label)) {
      cursor.registerServer({ name: label, server: { command: s.command, args: s.args, env: {} } });
      cursorServers.set(label, s);
    }
  }
}

async function chooseApp(apps, child) {
  const picked = await vscode.window.showQuickPick(apps, { title: 'Feega: which app to import?', placeHolder: 'This folder holds several apps' });
  child.stdin.write(`${picked ?? ''}\n`);
}

async function onEvent(event, child, file) {
  if (event.event === 'choose-app') {
    return chooseApp(event.apps, child);
  }

  if (event.event === 'imported') {
    await vscode.window.showInformationMessage(importMessage(event, file));
  }
}

function openCanvas(panel, file, launch, output) {
  panel.webview.options = { enableScripts: true };
  let child = null;
  const start = async () => {
    child = await startCanvas(panel, file, launch, output);
  };
  panel.webview.onDidReceiveMessage((message) => {
    if (message?.type !== RETRY) {
      return;
    }

    stop(child);
    start();
  });
  panel.onDidDispose(() => stop(child));
  return start();
}

async function startCanvas(panel, file, launch, output) {
  let progress = progressOf(launch);
  const show = () => {
    panel.webview.html = stepsPage(progress);
  };
  show();
  const port = await freePort();
  const tail = logTail(LOG_TAIL_LINES);
  const attempt = { ended: false, lastOutput: Date.now(), failed: false, served: null, imported: launch !== Launch.ImportFolder };
  attempts.set(panel, attempt);
  const { command, args } = launcherOf(devServerPath(), file, port, launch);
  output.appendLine(`feega: ${command} ${args.join(' ')}`);
  const child = spawn(command, args, spawnOptions(projectDir(file), process.platform, process.env));
  children.add(child);

  const current = () => attempts.get(panel) === attempt && !attempt.failed;
  const fail = (message, log = tail.text()) => {
    if (!current()) {
      return;
    }

    attempt.failed = true;
    output.appendLine(`feega: ${message}`);
    progress = failedAt(progress, message, log);
    show();
  };
  const reveal = () => {
    if (current() && attempt.served && attempt.imported) {
      panel.webview.html = canvasPage(attempt.served);
    }
  };
  const onStep = (event) => {
    if (!current()) {
      return;
    }

    if (event.event === 'import-failed') {
      return fail(`The folder import failed: ${event.message}`);
    }
    if (event.event === 'imported') {
      progress = finishedAll(progress);
      attempt.imported = true;
      return reveal();
    }
    progress = advance(progress, event);
    if (!attempt.served || !attempt.imported) {
      show();
    }
  };
  const events = eventReader((event) => {
    onStep(event);
    onEvent(event, child, file);
  });
  const log = (d) => {
    attempt.lastOutput = Date.now();
    output.append(d.toString());
    tail.push(d.toString());
  };
  const lines = eventReader(onStep);
  child.stdout.on('data', (d) => {
    log(d);
    events(d.toString());
  });
  child.stderr.on('data', (d) => {
    log(d);
    lines(d.toString());
  });
  child.on('error', (error) => {
    attempt.ended = true;
    fail(`Could not run ${command}: ${error.message}. Is Node.js 22+ installed?`);
  });
  child.on('exit', (code, signal) => {
    attempt.ended = true;
    children.delete(child);
    running.delete(file);
    publishMcp();
    if (!signal) {
      fail(`Feega stopped (exit ${code}).`);
    }
  });

  const url = localUrl(port);
  if (!(await ready(url, attempt))) {
    if (!attempt.ended) {
      stop(child);
      fail(`Feega did not start: no output for ${QUIET_TIMEOUT_MS / 1000} s.`);
    }
    return child;
  }

  running.set(file, port);
  publishMcp();
  attempt.served = (await vscode.env.asExternalUri(vscode.Uri.parse(url))).toString().replace(/\/$/, '');
  progress = advance(progress, { event: 'step', step: 'start', state: 'done' });
  if (!attempt.imported) {
    show();
  }
  reveal();
  return child;
}

function canvasEditor(output) {
  return {
    openCustomDocument: (uri) => ({ uri, dispose: () => {} }),
    resolveCustomEditor: (document, panel) => openCanvas(panel, document.uri.fsPath, Launch.Open, output)
  };
}

const devServerPath = () => vscode.workspace.getConfiguration('feega').get('devServerPath', '').trim();

const projectDir = (target) => (statSync(target, { throwIfNoEntry: false })?.isDirectory() ? target : dirname(target));

function migrateLegacy(folder, output) {
  const move = legacyMove(folder, existsSync);
  if (!move) {
    return;
  }

  renameSync(move.from, move.to);
  output.appendLine(`feega: ${move.from} moved to ${move.to}; Feega turns it into the .feega/ folder`);
}

function workspaceFolder() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage('Feega: open a folder first.');
  }
  return folder?.uri.fsPath ?? null;
}

function canvasPanel(file, launch, output) {
  const panel = vscode.window.createWebviewPanel('feega.canvas', file.split(/[\\/]/).pop(), vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true });
  panel.iconPath = vscode.Uri.joinPath(vscode.Uri.file(__dirname), 'icon.png');
  return openCanvas(panel, file, launch, output);
}

function openFolder(output, launch) {
  const folder = workspaceFolder();
  if (!folder) {
    return;
  }

  migrateLegacy(folder, output);
  return canvasPanel(folder, launch, output);
}

const INSTALL = 'Install Feega Inspect';
const LEARN = 'Learn more';

async function announceDeprecation() {
  const answer = await vscode.window.showInformationMessage(DEPRECATION.message, INSTALL, LEARN);
  if (answer === INSTALL) {
    return vscode.commands.executeCommand('workbench.extensions.search', DEPRECATION.extensionId);
  }
  if (answer === LEARN) {
    return vscode.env.openExternal(vscode.Uri.parse(DEPRECATION.docsUrl));
  }
}

function activate(context) {
  void announceDeprecation();
  const output = vscode.window.createOutputChannel('Feega');
  context.subscriptions.push(
    output,
    vscode.window.registerCustomEditorProvider('feega.canvas', canvasEditor(output), { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('feega.openProject', () => openFolder(output, Launch.Open)),
    vscode.commands.registerCommand('feega.importFolder', () => openFolder(output, Launch.ImportFolder))
  );

  if (vscode.lm?.registerMcpServerDefinitionProvider) {
    context.subscriptions.push(
      vscode.lm.registerMcpServerDefinitionProvider('feega.local', {
        onDidChangeMcpServerDefinitions: mcpChanged.event,
        provideMcpServerDefinitions: () => mcpServers(running).map((s) => new vscode.McpStdioServerDefinition(s.label, s.command, s.args))
      })
    );
  }

  return { runningCanvases, mcpServers: () => mcpServers(running) };
}

const runningCanvases = () => [...running].map(([file, port]) => ({ file, port }));

function stop(child) {
  if (!child) {
    return;
  }

  try {
    process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGTERM');
  } catch {
    child.kill();
  }
}

function deactivate() {
  children.forEach(stop);
}

module.exports = { activate, deactivate };
