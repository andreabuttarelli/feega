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

const Step = { Launch: 'launch', Download: 'download', Install: 'install', Start: 'start' };

const STEPS = {
  [Step.Launch]: { label: 'Starting Feega…', progress: 0.08 },
  [Step.Download]: { label: 'Downloading the app (first run only)…', progress: 0.3 },
  [Step.Install]: { label: 'Installing the app for this machine…', progress: 0.6 },
  [Step.Start]: { label: 'Loading the canvas…', progress: 0.85 }
};

const stepOf = (event) => (event.event === 'step' && STEPS[event.step] ? event.step : null);

const PRIDE = ['#E40303', '#FF8C00', '#FFED00', '#008026', '#004DFF', '#750787'];

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
.bar{position:relative;width:180px;height:4px;border-radius:9999px;background:var(--track);overflow:hidden}
.bar i{position:absolute;inset:0 auto 0 0;border-radius:9999px;background:linear-gradient(90deg,${PRIDE.join(',')});transition:width .6s cubic-bezier(.16,1,.3,1)}
.bar b{position:absolute;inset:0;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--bg) 55%,transparent),transparent);animation:sweep 1.4s cubic-bezier(.65,0,.35,1) infinite}
@keyframes sweep{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.bar b{animation:none}}
.step{font-size:13px;color:var(--muted)}
.error{font-size:13px;max-width:560px;text-align:center}
pre{max-width:min(720px,100%);max-height:40vh;overflow:auto;margin:0;padding:12px;border-radius:6px;background:var(--panel);color:var(--muted);font-size:11px;white-space:pre-wrap;word-break:break-all;box-sizing:border-box}
button{font:inherit;font-size:13px;padding:6px 14px;border:0;border-radius:4px;background:var(--fg);color:var(--bg);cursor:pointer}
</style></head><body><main>${MARK}<span class="name">feega</span>${body}</main></body></html>`;

const loadingPage = (step) => {
  const { label, progress } = STEPS[step];
  return shell(`<div class="bar" role="progressbar" aria-label="${label}"><i style="width:${Math.round(progress * 100)}%"></i><b></b></div><span class="step">${label}</span>`);
};

const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const errorPage = (message, log) =>
  shell(`<span class="error">${escapeHtml(message)}</span>${log.trim() ? `<pre>${escapeHtml(log)}</pre>` : ''}<button id="retry">Retry</button>
<script>const vscode = acquireVsCodeApi(); document.getElementById('retry').onclick = () => vscode.postMessage({ type: '${RETRY}' });</script>`);

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

const eventReader = (onEvent) => {
  let pending = '';
  return (chunk) => {
    const lines = (pending + chunk).split('\n');
    pending = lines.pop();
    for (const line of lines.filter((l) => l.startsWith(EVENT_PREFIX))) {
      try {
        onEvent(JSON.parse(line.slice(EVENT_PREFIX.length)));
      } catch {}
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

module.exports = { eventReader, importMessage, gitignoreWith, readyProbe, served, Launch, launchArgs, mcpServers, canvasFileFor, canvasPage, loadingPage, errorPage, logTail, spawnOptions, Step, stepOf, RETRY, localUrl, freePort };
