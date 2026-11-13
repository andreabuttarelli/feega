const vscode = require('vscode');
const { spawn } = require('node:child_process');
const { readFile, writeFile } = require('node:fs/promises');
const { Launch, launchArgs, mcpServers, canvasFileFor, canvasPage, eventReader, importMessage, gitignoreWith, progressOf, advance, failedAt, finishedAll, stepsPage, logTail, spawnOptions, RETRY, localUrl, freePort, readyProbe, served } = require('./canvas-run');

const READY_POLL_MS = 400;
const QUIET_TIMEOUT_MS = 180_000;
const LOG_TAIL_LINES = 40;
const NEW_CANVAS = 'canvas.feega';

const running = new Map();
const attempts = new WeakMap();
const mcpChanged = new vscode.EventEmitter();
const cursorServers = new Map();
const children = new Set();
const GITIGNORE_ASKED = 'feega.gitignoreAsked';
const ADD = 'Add to .gitignore';
let state = null;

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

async function offerGitignore(folder) {
  if (state.get(GITIGNORE_ASKED)) {
    return;
  }

  await state.update(GITIGNORE_ASKED, true);
  const path = `${folder}/.gitignore`;
  const current = await readFile(path, 'utf8').catch(() => '');
  const next = gitignoreWith(current);
  if (next === null) {
    return;
  }

  const answer = await vscode.window.showInformationMessage('The canvas file lives inside this folder. Add *.feega to .gitignore?', ADD, 'Not now');
  if (answer === ADD) {
    await writeFile(path, next);
  }
}

async function onEvent(event, child, file) {
  if (event.event === 'choose-app') {
    return chooseApp(event.apps, child);
  }

  if (event.event === 'imported') {
    await vscode.window.showInformationMessage(importMessage(event, file));
    return offerGitignore(file.replace(/[\\/][^\\/]*$/, ''));
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
  const child = spawn('npx', launchArgs(file, port, launch), spawnOptions(file, process.platform, process.env));
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
    fail(`Could not run npx: ${error.message}. Is Node.js 22+ installed?`);
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

async function newCanvas(output) {
  const folder = workspaceFolder();
  if (!folder) {
    return;
  }

  const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${folder}/${NEW_CANVAS}`), filters: { Feega: ['feega'] } });
  if (!target) {
    return;
  }

  return canvasPanel(target.fsPath, Launch.Open, output);
}

function importFolder(output) {
  const folder = workspaceFolder();
  if (!folder) {
    return;
  }

  return canvasPanel(canvasFileFor(folder), Launch.ImportFolder, output);
}

function activate(context) {
  state = context.workspaceState;
  const output = vscode.window.createOutputChannel('Feega');
  context.subscriptions.push(
    output,
    vscode.window.registerCustomEditorProvider('feega.canvas', canvasEditor(output), { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('feega.newCanvas', () => newCanvas(output)),
    vscode.commands.registerCommand('feega.importFolder', () => importFolder(output))
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
