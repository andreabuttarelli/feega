const { createServer } = require('node:net');
const { basename, join } = require('node:path');

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

const DEV_SCRIPT = ['scripts', 'local.mjs'];

const launcherOf = (devServerPath, target, port, launch) =>
  devServerPath ? { command: 'node', args: [join(devServerPath, ...DEV_SCRIPT), target, `--port=${port}`] } : { command: 'npx', args: launchArgs(target, port, launch) };

const legacyMove = (folder, exists) => {
  const from = join(folder, `${basename(folder)}${EXTENSION}`);
  const to = join(folder, EXTENSION);
  return exists(from) && !exists(to) ? { from, to } : null;
};

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

const progressOf = (launch) => ({ steps: LAUNCH_STEPS[launch].map((id, i) => ({ id, state: i === 0 ? State.Active : State.Pending })), error: null });

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
const MARK = `<svg class="mark" width="20" height="20" viewBox="0 0 300 300" aria-hidden="true">${[0, 90, 180, 270].map((a) => MARK_PETAL.replace('ANGLE', a)).join('')}</svg>`;

const RETRY = 'retry';

const ICONS = {
  [State.Pending]: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.25" class="track"/></svg>',
  [State.Active]: '<svg viewBox="0 0 16 16" class="spin"><circle cx="8" cy="8" r="6.25" class="track"/><circle cx="8" cy="8" r="6.25" class="arc"/></svg>',
  [State.Done]: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" class="fill"/><path d="M5 8.2l2 2 4-4.2" class="tick"/></svg>',
  [State.Error]: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" class="bad"/><path d="M8 4.6v4.2M8 11.1v.1" class="tick"/></svg>'
};

const Phase = { Working: 'working', Ready: 'ready', Failed: 'failed' };

const HEADLINES = { [Phase.Working]: 'opening your canvas.', [Phase.Ready]: 'ready.', [Phase.Failed]: 'something went wrong.' };

const phaseOf = (progress) => {
  if (progress.error) {
    return Phase.Failed;
  }
  return progress.steps.every((s) => s.state === State.Done) ? Phase.Ready : Phase.Working;
};

const FIELD = `<script>
(() => {
  const RAMP = ' .:-=+*#%@';
  const STOPS = [[228,3,3],[255,140,0],[255,237,0],[0,128,38],[0,77,255],[117,7,135]];
  const WAVES = [[0.11,0.07,1.6,0],[-0.06,0.13,1.2,1.7],[0.04,-0.09,2.1,3.1]];
  const LOOP_MS = 24000;
  const CELL = 13;
  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lift = (c) => { const g = Math.max(1, 200 / Math.max(...c)); return c.map((v) => Math.min(255, Math.round(v * g))); };
  const tint = (t) => { const p = Math.min(1, Math.max(0, t)) * (STOPS.length - 1); const i = Math.min(STOPS.length - 2, Math.floor(p)); const f = p - i; return lift(STOPS[i].map((a, k) => a + (STOPS[i + 1][k] - a) * f)); };
  const field = (x, y, phase) => { const a = phase * Math.PI * 2; let sum = 0; for (const [kx, ky, r, off] of WAVES) { const warp = Math.sin(y * 0.05 + r * Math.sin(a) + off) * 2; sum += Math.sin((x + warp) * kx + y * ky + r * Math.cos(a) + off); } return (sum / WAVES.length + 1) / 2; };
  const envelope = (nx, ny) => { const r = Math.min(1, Math.hypot((nx - 0.5) * 2, (ny - 0.5) * 2) / Math.SQRT2); return 1 - r * r * (3 - 2 * r); };
  let cols = 0, rows = 0;
  const size = () => { const dpr = Math.min(devicePixelRatio || 1, 2); const { width, height } = canvas.getBoundingClientRect(); canvas.width = width * dpr; canvas.height = height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = CELL + 'px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; cols = Math.ceil(width / CELL); rows = Math.ceil(height / CELL); };
  const draw = () => {
    const phase = (Date.now() % LOOP_MS) / LOOP_MS;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const e = envelope((c + 0.5) / cols, (r + 0.5) / rows);
        const d = Math.sqrt(field(c * CELL * 0.09, r * CELL * 0.09, phase)) * (0.6 + 0.4 * e);
        const glyph = RAMP[Math.round(Math.min(1, d) * (RAMP.length - 1))];
        if (glyph === ' ') continue;
        const [R, G, B] = tint(1 - e);
        ctx.fillStyle = 'rgb(' + R + ',' + G + ',' + B + ')';
        ctx.globalAlpha = 0.3 + d * 0.45;
        ctx.fillText(glyph, c * CELL + CELL / 2, r * CELL + CELL / 2);
      }
    }
  };
  const tick = () => { draw(); if (!still) setTimeout(() => requestAnimationFrame(tick), 33); };
  new ResizeObserver(() => { size(); draw(); }).observe(canvas);
  size();
  tick();
})();
</script>`;

const shell = (progress, body) => `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
:root{--bg:#fff;--fg:#141414;--muted:#6b6b6b;--faint:#a3a3a3;--track:color-mix(in srgb,#1d1d1f 12%,transparent);--panel:#f4f4f4;--accent:#ff5100;--bad:#e5484d}
body.vscode-dark,body.vscode-high-contrast{--bg:#0b0b0b;--fg:#f2f2f2;--muted:#9a9a9a;--faint:#5c5c5c;--track:color-mix(in srgb,#ededed 14%,transparent);--panel:#161616}
*{box-sizing:border-box}
html,body{margin:0;height:100vh;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{height:100vh;display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1fr);gap:0}
.art{position:relative;margin:12px 0 12px 12px;border-radius:10px;overflow:hidden;background:#000}
.art canvas{position:absolute;inset:0;width:100%;height:100%}
.art::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgb(0 0 0/.5),rgb(0 0 0/0) 30%,rgb(0 0 0/0) 55%,rgb(0 0 0/.85))}
.art p{position:absolute;z-index:1;left:32px;right:32px;bottom:28px;margin:0;color:#fff;font-size:clamp(28px,3.4vw,52px);font-weight:600;letter-spacing:-.045em;line-height:.98}
.side{display:grid;grid-template-rows:auto 1fr;min-height:0;overflow:auto}
header{display:flex;align-items:center;gap:8px;padding:24px 40px 0;font-size:16px;font-weight:600;letter-spacing:-.03em}
.mark{fill:var(--accent)}
.body{align-self:safe center;width:min(380px,100%);margin:0 auto;padding:32px 24px 48px}
h1{margin:0 0 8px;font-size:clamp(30px,3vw,44px);font-weight:600;letter-spacing:-.045em;line-height:.98}
.count{margin:0 0 20px;font-size:13px;color:var(--muted)}
.bar{height:3px;margin:0 0 24px;border-radius:9999px;background:var(--track);overflow:hidden}
.bar i{display:block;height:100%;border-radius:9999px;background:var(--fg);transition:width .5s cubic-bezier(.16,1,.3,1)}
.steps{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.steps li{display:flex;align-items:center;gap:12px;min-height:36px;padding:0 12px;border-radius:6px;font-size:13px;color:var(--faint)}
.steps li.active{background:var(--panel);color:var(--fg);font-weight:500}
.steps li.done{color:var(--muted)}
.steps li.error{background:color-mix(in srgb,var(--bad) 10%,transparent);color:var(--bad);font-weight:500}
.steps svg{width:16px;height:16px;flex:none;overflow:visible}
.track{fill:none;stroke:var(--track);stroke-width:1.5}
.arc{fill:none;stroke:var(--accent);stroke-width:1.5;stroke-linecap:round;stroke-dasharray:12 40}
.spin{animation:spin .9s linear infinite;transform-origin:50% 50%}
.fill{fill:var(--muted)}
.bad{fill:var(--bad)}
.tick{fill:none;stroke:var(--bg);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.spin{animation:none}}
.error{display:block;margin:16px 0 8px;font-size:13px;color:var(--bad)}
pre{max-height:32vh;overflow:auto;margin:0 0 12px;padding:12px;border-radius:6px;background:var(--panel);color:var(--muted);font-size:11px;white-space:pre-wrap;word-break:break-all}
button{font:inherit;font-size:13px;font-weight:600;min-height:36px;padding:0 18px;border:0;border-radius:9999px;background:var(--fg);color:var(--bg);cursor:pointer}
@media (max-width:720px){main{grid-template-columns:minmax(0,1fr)}.art{display:none}header{padding:16px 20px 0}.body{align-self:start;padding:24px 20px}}
</style></head><body><main>
<div class="art" aria-hidden="true"><canvas id="field"></canvas><p>${HEADLINES[phaseOf(progress)]}</p></div>
<div class="side"><header>${MARK}feega</header><div class="body">${body}</div></div>
</main>${FIELD}</body></html>`;

const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const row = (s) => `<li class="${s.state}">${ICONS[s.state]}${escapeHtml(LABELS[s.id](s))}</li>`;

const failure = (error) =>
  error
    ? `<span class="error">${escapeHtml(error.message)}</span>${error.log.trim() ? `<pre>${escapeHtml(error.log)}</pre>` : ''}<button id="retry">Retry</button>
<script>const vscode = acquireVsCodeApi(); document.getElementById('retry').onclick = () => vscode.postMessage({ type: '${RETRY}' });</script>`
    : '';

const STEP_TITLES = { [Phase.Working]: 'setting up', [Phase.Ready]: 'all set', [Phase.Failed]: 'stopped' };

const summary = (progress) => {
  const done = progress.steps.filter((s) => s.state === State.Done).length;
  const total = progress.steps.length;
  return `<h1>${STEP_TITLES[phaseOf(progress)]}</h1><p class="count">${done} of ${total} done</p><div class="bar"><i style="width:${Math.round((done / total) * 100)}%"></i></div>`;
};

const stepsPage = (progress) => shell(progress, `${summary(progress)}<ol class="steps">${progress.steps.map(row).join('')}</ol>${failure(progress.error)}`);

const logTail = (max) => {
  let kept = '';
  return {
    push: (chunk) => {
      kept = (kept + chunk).split('\n').slice(-max - 1).join('\n');
    },
    text: () => kept
  };
};

const spawnOptions = (cwd, platform, env) => ({ cwd, shell: platform === 'win32', env, detached: platform !== 'win32' });

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

const DEPRECATION = {
  message: 'The Feega canvas extension is deprecated. Feega Inspect replaces it: edit your running app visually, right in the editor.',
  extensionId: 'AndreaButtarelli.feega-inspect',
  docsUrl: 'https://github.com/andreabuttarelli/feega/tree/main/inspect'
};

module.exports = { DEPRECATION, eventReader, importMessage, readyProbe, served, Launch, launchArgs, launcherOf, legacyMove, mcpServers, canvasPage, progressOf, advance, failedAt, finishedAll, stepsPage, lineEvent, logTail, spawnOptions, Step, RETRY, localUrl, freePort };
