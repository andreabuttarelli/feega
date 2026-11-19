#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, realpathSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline/promises';

import { sendTelemetry, telemetryEnv } from '../telemetry.mjs';
import { ImportStep, MCP_ENTRY, USAGE, appDir, bundleSource, boundUrl, cachedVersions, compileCache, depsDir, exitOf, exited, extract, folderApp, freePort, importAsk, discoverAsk, importReport, installAtomic, loadingServer, newerRelease, routePlan, eventLine, importStep, isCached, latestAppVersion, mcpEnv, parseArgs, pickVersion, placeOf, readyProbe, served, untilReady, warmStart } from '../launcher.mjs';

const MIN_NODE_MAJOR = 22;
const WEBSTORAGE_NODE_MAJOR = 25;
const READY_POLL_MS = 20;
const OPENERS = { darwin: ['open'], win32: ['cmd', '/c', 'start', ''] };
const RELEASES_API = 'https://api.github.com/repos/andreabuttarelli/feega/releases?per_page=50';
const CHECK_TIMEOUT_MS = 2000;
const LOCAL_BUNDLE_VERSION = 'local';
const HTTP_CONFLICT = 409;
const CHOOSE_APP_TIMEOUT_MS = 120_000;
const TO_STDERR = ['ignore', 2, 2];

const nodeMajor = Number(process.versions.node.split('.')[0]);

const LOCKFILE = 'package-lock.json';
const DEPS_FILES = ['package.json', LOCKFILE];
const NODE_MODULES = 'node_modules';
const LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir';

async function latestRelease() {
  try {
    const res = await fetch(RELEASES_API, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS), headers: { accept: 'application/vnd.github+json' } });
    return res.ok ? latestAppVersion(await res.json()) : null;
  } catch {
    return null;
  }
}

async function chooseVersion(home) {
  if (process.env.FEEGA_APP_BUNDLE) {
    const cached = isCached(appDir(home, LOCAL_BUNDLE_VERSION)) ? [LOCAL_BUNDLE_VERSION] : [];
    return pickVersion(LOCAL_BUNDLE_VERSION, cached);
  }

  const cached = cachedVersions(home);
  const warm = warmStart(cached);
  return warm.action === 'cache' ? warm : pickVersion(await latestRelease(), cached);
}

const MESSAGES = {
  download: (version) => `feega: downloading the app ${version} (once per version)…`,
  install: () => 'feega: installing its dependencies for this machine…'
};

const announce = (loading) => (step, version) => {
  console.log(eventLine({ event: 'step', step }));
  console.error(MESSAGES[step](version));
  loading?.set({ step });
};

const quiet = { report: () => {}, stdio: 'ignore' };

async function installDeps(dir, home, { report, stdio }) {
  const deps = depsDir(home, readFileSync(join(dir, LOCKFILE), 'utf8'));
  if (!isCached(deps)) {
    report('install');
    await installAtomic(deps, async (tmp) => {
      DEPS_FILES.forEach((file) => copyFileSync(join(dir, file), join(tmp, file)));
      const npm = spawn('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: tmp, stdio, shell: process.platform === 'win32' });
      if ((await exited(npm)) !== 0) {
        throw new Error('could not install the app dependencies');
      }
    });
  }

  symlinkSync(join(deps, NODE_MODULES), join(dir, NODE_MODULES), LINK_TYPE);
}

function install(dir, version, home, how) {
  return installAtomic(dir, async (tmp) => {
    how.report('download', version);
    await extract(bundleSource(version, process.env), tmp);
    await installDeps(tmp, home, how);
  });
}

async function refresh(home) {
  const latest = newerRelease(await latestRelease(), cachedVersions(home));
  if (latest) {
    await install(appDir(home, latest), latest, home, quiet).catch(() => {});
  }
}

async function whenReady(url, server) {
  const exit = new Promise((r) => server.once('exit', r));
  await untilReady(() => fetch(url, readyProbe).then((r) => served(r.status), () => false), exit, READY_POLL_MS);
}

function openBrowser(url) {
  const [cmd, ...args] = OPENERS[process.platform] ?? ['xdg-open'];
  spawn(cmd, [...args, url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

async function readyApp(home, report) {
  const { version, action } = await chooseVersion(home);
  const dir = appDir(home, version);
  if (action === 'download') {
    await install(dir, version, home, { report, stdio: TO_STDERR });
  }

  return { dir, warm: action === 'cache' && version !== LOCAL_BUNDLE_VERSION };
}

async function openLoading(browser) {
  if (browser !== 'open') {
    return null;
  }

  const loading = await loadingServer();
  openBrowser(loading.url);
  return loading;
}

async function wantsImport(app, fileExists, mode) {
  const step = importStep({ mode, app, fileExists, tty: Boolean(process.stdin.isTTY && process.stdout.isTTY) });
  if (step === ImportStep.NoApp) {
    throw new Error(`nothing to import: ${process.cwd()} has no package.json with a "dev" script`);
  }

  if (step !== ImportStep.Ask) {
    return step === ImportStep.Import;
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await prompt.question(`feega: import the current folder (${basename(app)}) into the canvas? (Y/n) `)).trim().toLowerCase();
  prompt.close();
  return answer === '' || answer.startsWith('y');
}

async function fetchJson(url, path, init) {
  const res = await fetch(new URL(path, url), init);
  return { res, body: await res.json().catch(() => ({})) };
}

async function pickApp(apps) {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (interactive) {
    apps.forEach((app, i) => console.log(`  ${i + 1}) ${app}`));
  } else {
    console.log(eventLine({ event: 'choose-app', apps }));
  }

  const question = interactive ? input.question('feega: which app to import? (number) ') : new Promise((done) => input.once('line', done));
  const closed = new Promise((done) => input.once('close', () => done('')));
  const timeout = new Promise((done) => setTimeout(() => done(''), CHOOSE_APP_TIMEOUT_MS).unref());
  const answer = String(await Promise.race([question, closed, timeout])).trim();
  input.close();
  return apps.find((app, i) => answer === app || answer === String(i + 1));
}

async function discover(url, place, folder, app) {
  const { res, body } = await fetchJson(url, discoverAsk(place, folder, app));
  if (res.status === HTTP_CONFLICT && body.apps?.length && !app) {
    const chosen = await pickApp(body.apps);
    if (!chosen) {
      throw new Error(`this folder holds several apps (${body.apps.join(', ')}): pass --app <path>`);
    }

    return discover(url, place, folder, chosen);
  }

  return { found: res.ok ? { ok: true, ...body } : { ok: false }, app: app ?? body.app };
}

async function importFolder(url, folder, { routes, app, file }) {
  const home = await fetch(url, readyProbe);
  const place = placeOf(home.headers.get('location'));
  if (!place) {
    throw new Error('could not find the local canvas');
  }

  console.log(eventLine({ event: 'step', step: 'find', state: 'active' }));
  console.log(`feega: looking for the pages of ${basename(folder)}…`);
  const discovered = await discover(url, place, folder, app);
  const plan = routePlan(discovered.found, routes);
  if (plan.fallback) {
    console.log('feega: no router found, importing the home page only');
  }

  console.log(eventLine({ event: 'step', step: 'find', state: 'done', pages: plan.routes.length }));
  console.log(`feega: importing ${basename(folder)}: ${plan.routes.length} pages (starts its dev server, can take a minute)…`);
  const { path, body } = importAsk(place, folder, { routes: plan.routes, app: discovered.app });
  const { res, body: done } = await fetchJson(url, path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    throw new Error(`folder import failed: ${done.detail ?? done.error ?? res.status}`);
  }

  const report = importReport(plan, done);
  report.lines.forEach((line) => console.log(line));
  console.log(eventLine({ event: 'imported', pages: report.imported.length, needsValue: report.needsValue, leftOut: report.leftOut.length, file }));
}

function forward(child) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('exit', (code, signal) => {
    const out = exitOf(code, signal);
    if (out.line) {
      console.error(out.line);
    }
    process.exit(out.code);
  });
}

function serveMcp(dir, port) {
  const entry = join(dir, MCP_ENTRY);
  if (!existsSync(entry)) {
    throw new Error('this app version has no MCP server: run `npx feega@latest mcp`');
  }

  forward(spawn(process.execPath, [entry], { stdio: 'inherit', env: mcpEnv(port, process.env) }));
}

async function main() {
  if (nodeMajor < MIN_NODE_MAJOR) {
    throw new Error(`Node ${MIN_NODE_MAJOR}+ is required (found ${process.versions.node})`);
  }

  const args = parseArgs(process.argv.slice(2), process.cwd());
  if (args.command === 'help') {
    console.log(USAGE);
    return;
  }

  if (args.command === 'version') {
    console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
    return;
  }

  const home = homedir();
  if (args.command === 'mcp') {
    serveMcp((await readyApp(home, announce(null))).dir, args.port);
    return;
  }

  const { file, browser, folderImport, routes, app: chosenApp } = args;
  const fileExists = existsSync(file);
  const port = await freePort(args.port);
  const url = boundUrl(port);
  const loading = await openLoading(browser);
  const { dir, warm } = await readyApp(home, announce(loading));

  console.log(eventLine({ event: 'step', step: 'start' }));
  console.log(`feega: saving to ${file}`);
  console.log(`feega: open ${url}`);

  const nodeOptions = nodeMajor >= WEBSTORAGE_NODE_MAJOR ? '--no-experimental-webstorage' : '';
  const env = { ...process.env, ...telemetryEnv(home, process.env), ...compileCache(home, process.env), NODE_OPTIONS: [process.env.NODE_OPTIONS, nodeOptions].filter(Boolean).join(' ') };
  const server = spawn(process.execPath, [realpathSync(join(dir, 'scripts/local.mjs')), file, `--port=${port}`], { stdio: 'inherit', env });

  const app = folderApp(process.cwd());
  const importing = wantsImport(app, fileExists, folderImport);
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  void sendTelemetry({
    home,
    env: process.env,
    notify: (line) => console.error(line),
    info: { version, platform: process.platform, arch: process.arch, node: process.versions.node }
  });

  await whenReady(url, server).catch((error) => {
    loading?.set({ error: `feega: ${error.message}` });
    throw error;
  });
  loading?.set({ url });
  forward(server);
  if (warm) {
    void refresh(home);
  }

  if (await importing) {
    await importFolder(url, app, { routes, app: chosenApp, file }).catch((error) => {
      console.error(`feega: ${error.message}`);
      console.log(eventLine({ event: 'import-failed', message: error.message }));
    });
  }
}

main().catch((error) => {
  console.error(`feega: ${error.message}`);
  process.exit(1);
});
