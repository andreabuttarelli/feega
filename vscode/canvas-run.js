const { createServer } = require('node:net');
const { basename, dirname, join } = require('node:path');

const PACKAGE = 'feega@latest';
const LOOPBACK = '127.0.0.1';
const EXTENSION = '.feega';
const HTTP_ERROR_MIN = 400;

const readyProbe = { redirect: 'manual' };

const served = (status) => status < HTTP_ERROR_MIN;

const Launch = { Open: 'open', ImportFolder: 'import-folder' };

const IMPORT_FLAGS = { [Launch.Open]: [], [Launch.ImportFolder]: ['--import'] };

const launchArgs = (file, port, launch) => ['-y', PACKAGE, file, '--port', String(port), '--no-open', ...IMPORT_FLAGS[launch]];

const mcpServers = (running) =>
  [...running].map(([file, port]) => ({ label: `feega ${basename(file, EXTENSION)}`, command: 'npx', args: ['-y', PACKAGE, 'mcp', '--port', String(port)] }));

const canvasFileFor = (folder) => join(folder, `${basename(folder)}${EXTENSION}`);

const localUrl = (port) => `http://${LOOPBACK}:${port}`;

const canvasPage = (url) => `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${url}; style-src 'unsafe-inline'">
<style>html,body,iframe{margin:0;padding:0;border:0;width:100%;height:100vh;overflow:hidden;background:#111}</style>
</head><body><iframe src="${url}" allow="clipboard-read; clipboard-write; fullscreen"></iframe></body></html>`;

const Step = { App: 'app', Start: 'start', Find: 'find', Dependencies: 'dependencies', DevServer: 'dev-server', Pages: 'pages' };

const State = { Pending: 'pending', Active: 'active', Done: 'done', Error: 'error' };

const LAUNCH_STEPS = {
  [Launch.Open]: [Step.App, Step.Start],
  [Launch.ImportFolder]: [Step.App, Step.Start, Step.Find, Step.Dependencies, Step.DevServer, Step.Pages]
};

const LABELS = {
  [Step.App]: () => 'Download the app',
  [Step.Start]: () => 'Start Feega',
  [Step.Find]: (s) => (s.pages ? `Find pages (${s.pages})` : 'Find pages'),
  [Step.Dependencies]: (s) => (s.manager ? `Install dependencies (${s.manager})` : 'Install dependencies'),
  [Step.DevServer]: () => 'Start the dev server',
  [Step.Pages]: (s) => (s.index ? `Import page ${s.index}/${s.total}` : 'Import pages')
};

const EVENT_STEPS = { download: Step.App, install: Step.App, start: Step.Start, find: Step.Find, dependencies: Step.Dependencies, 'dev-server': Step.DevServer, page: Step.Pages };

const FINISHED = new Set(['done', 'skipped']);

const progressOf = (launch) => ({ steps: LAUNCH_STEPS[launch].map((id) => ({ id, state: State.Pending })), error: null });

const advance = (progress, event) => {
  const id = event.event === 'step' ? EVENT_STEPS[event.step] : null;
  const at = progress.steps.findIndex((s) => s.id === id);
  if (at < 0) {
    return progress;
  }

  const finished = FINISHED.has(event.state);
  const { event: _e, step: _s, state: _st, ...facts } = event;
  const steps = progress.steps.map((s, i) => {
    if (i < at) {
      return { ...s, state: State.Done };
    }
    if (i === at) {
      return { ...s, ...facts, state: finished ? State.Done : State.Active };
    }
    if (i === at + 1 && finished && s.state === State.Pending) {
      return { ...s, state: State.Active };
    }
    return s;
  });
  return { ...progress, steps };
};

const finishedAll = (progress) => ({ ...progress, steps: progress.steps.map((s) => ({ ...s, state: State.Done })) });

const failedAt = (progress, message, log) => {
  const active = progress.steps.findIndex((s) => s.state === State.Active);
  const at = active >= 0 ? active : Math.max(0, progress.steps.findIndex((s) => s.state === State.Pending));
  return { steps: progress.steps.map((s, i) => (i === at ? { ...s, state: State.Error } : s)), error: { message, log } };
};

const LOOKING = /^feega: looking for the pages of /;
const IMPORTING = /^feega: importing .+: (\d+) pages/;
const IMPORT_FAILED = /^feega: folder import failed: (.*)$/;

const lineEvent = (line) => {
  if (LOOKING.test(line)) {
    return { event: 'step', step: 'find', state: 'active' };
  }
  const importing = line.match(IMPORTING);
  if (importing) {
    return { event: 'step', step: 'find', state: 'done', pages: Number(importing[1]) };
  }
  const failed = line.match(IMPORT_FAILED);
  return failed ? { event: 'import-failed', message: failed[1] } : null;
};

const MARK_PETAL = '<path d="M61.87 142.25A57 57 0 1 1 136.13 142.25A69.5 69.5 0 0 0 61.87 142.25Z" transform="rotate(ANGLE 150 150)"/>';
const MARK = `<svg width="48" height="48" viewBox="0 0 300 300" aria-hidden="true">${[0, 90, 180, 270].map((a) => MARK_PETAL.replace('ANGLE', a)).join('')}</svg>`;

const RETRY = 'retry';

const shell = (body) => `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
:root{--bg:#fff;--fg:#141414;--muted:#6b6b6b;--track:color-mix(in srgb,#1d1d1f 10%,transparent);--panel:#f4f4f4}
body.vscode-dark,body.vscode-high-contrast{--bg:#000;--fg:#f2f2f2;--muted:#9a9a9a;--track:color-mix(in srgb,#ededed 10%,transparent);--panel:#141414}
html,body{margin:0;height:100vh;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:0 16px;box-sizing:border-box}
svg{fill:#ff5100}
.name{font-size:40px;font-weight:600;line-height:1;letter-spacing:-0.02em}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;font-size:13px;min-width:220px}
.steps li{display:flex;align-items:center;gap:10px;color:var(--muted)}
.steps li i{width:10px;height:10px;border-radius:9999px;border:1.5px solid currentColor;box-sizing:border-box;flex:none}
.steps li.active{color:var(--fg)}
.steps li.active i{border-color:#ff5100;border-right-color:transparent;animation:spin .8s linear infinite}
.steps li.done i{background:currentColor}
.steps li.error{color:#e5484d}
.steps li.error i{background:#e5484d;border-color:#e5484d}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.steps li.active i{animation:none}}
.error{font-size:13px;max-width:560px;text-align:center}
pre{max-width:min(720px,100%);max-height:40vh;overflow:auto;margin:0;padding:12px;border-radius:6px;background:var(--panel);color:var(--muted);font-size:11px;white-space:pre-wrap;word-break:break-all;box-sizing:border-box}
button{font:inherit;font-size:13px;padding:6px 14px;border:0;border-radius:4px;background:var(--fg);color:var(--bg);cursor:pointer}
</style></head><body><main>${MARK}<span class="name">feega</span>${body}</main></body></html>`;

const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const row = (s) => `<li class="${s.state}"><i></i>${escapeHtml(LABELS[s.id](s))}</li>`;

const failure = (error) =>
  error
    ? `<span class="error">${escapeHtml(error.message)}</span>${error.log.trim() ? `<pre>${escapeHtml(error.log)}</pre>` : ''}<button id="retry">Retry</button>
<script>const vscode = acquireVsCodeApi(); document.getElementById('retry').onclick = () => vscode.postMessage({ type: '${RETRY}' });</script>`
    : '';

const stepsPage = (progress) => shell(`<ol class="steps">${progress.steps.map(row).join('')}</ol>${failure(progress.error)}`);

const logTail = (max) => {
  let kept = '';
  return {
    push: (chunk) => {
      kept = (kept + chunk).split('\n').slice(-max - 1).join('\n');
    },
    text: () => kept
  };
};

const spawnOptions = (file, platform, env) => ({ cwd: dirname(file), shell: platform === 'win32', env, detached: platform !== 'win32' });

const freePort = () =>
  new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, LOOPBACK, () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

const EVENT_PREFIX = 'feega:event ';

const parsed = (json) => {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const eventReader = (onEvent) => {
  let pending = '';
  return (chunk) => {
    const lines = (pending + chunk).split('\n');
    pending = lines.pop();
    for (const line of lines) {
      const event = line.startsWith(EVENT_PREFIX) ? parsed(line.slice(EVENT_PREFIX.length)) : lineEvent(line);
      if (event) {
        onEvent(event);
      }
    }
  };
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const importMessage = ({ pages, needsValue, leftOut }, file) => {
  const parts = [`Imported ${plural(pages, 'page')}`];
  if (needsValue) {
    parts.push(`${needsValue} need a value`);
  } else if (leftOut) {
    parts.push(`${leftOut} left out (see the Feega output)`);
  }

  return `${parts.join('; ')}. Canvas: ${file}`;
};

const GITIGNORE_ENTRY = '*.feega';

const gitignoreWith = (content) => {
  const lines = content.split('\n').map((l) => l.trim());
  if (lines.includes(GITIGNORE_ENTRY)) {
    return null;
  }

  const base = content === '' || content.endsWith('\n') ? content : `${content}\n`;
  return `${base}${GITIGNORE_ENTRY}\n`;
};

module.exports = { eventReader, importMessage, gitignoreWith, readyProbe, served, Launch, launchArgs, mcpServers, canvasFileFor, canvasPage, progressOf, advance, failedAt, finishedAll, stepsPage, lineEvent, logTail, spawnOptions, Step, RETRY, localUrl, freePort };
