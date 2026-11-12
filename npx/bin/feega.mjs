#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { sendTelemetry, telemetryEnv } from '../telemetry.mjs';
import { ImportStep, MCP_ENTRY, USAGE, appDir, bundleSource, boundUrl, cachedVersions, folderApp, freePort, importAsk, importStep, isCached, latestAppVersion, markCached, mcpEnv, parseArgs, pickVersion, placeOf, readyProbe, served } from '../launcher.mjs';

const MIN_NODE_MAJOR = 22;
const WEBSTORAGE_NODE_MAJOR = 25;
const READY_POLL_MS = 300;
const OPENERS = { darwin: ['open'], win32: ['cmd', '/c', 'start', ''] };
const RELEASES_API = 'https://api.github.com/repos/andreabuttarelli/feega/releases?per_page=50';
const CHECK_TIMEOUT_MS = 2000;
const LOCAL_BUNDLE_VERSION = 'local';
const TO_STDERR = ['ignore', 2, 2];

const nodeMajor = Number(process.versions.node.split('.')[0]);

async function download(source, target) {
  if (!source.startsWith('http')) {
    return source;
  }

  const res = await fetch(source);
  if (!res.ok) {
    throw new Error(`download failed (${res.status}): ${source}`);
  }

  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
  return target;
}

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

  return pickVersion(await latestRelease(), cachedVersions(home));
}

async function install(dir, version) {
  console.error(`feega: downloading the app ${version} (once per version)…`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const archive = await download(bundleSource(version, process.env), join(tmpdir(), `feega-app-${version}-${process.pid}.tar.gz`));
  const untar = spawnSync('tar', ['-xzf', archive, '-C', dir], { stdio: TO_STDERR });
  if (untar.status !== 0) {
    throw new Error('could not extract the app bundle');
  }

  console.error('feega: installing its dependencies for this machine…');
  const deps = spawnSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'], {
    cwd: dir,
    stdio: TO_STDERR,
    shell: process.platform === 'win32'
  });
  if (deps.status !== 0) {
    throw new Error('could not install the app dependencies');
  }

  markCached(dir);
}

async function whenReady(url) {
  while (!(await fetch(url, readyProbe).then((r) => served(r.status), () => false))) {
    await new Promise((r) => setTimeout(r, READY_POLL_MS));
  }
}

function openBrowser(url) {
  const [cmd, ...args] = OPENERS[process.platform] ?? ['xdg-open'];
  spawn(cmd, [...args, url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

async function readyApp() {
  const { version, action } = await chooseVersion(homedir());
  const dir = appDir(homedir(), version);
  if (action === 'download') {
    await install(dir, version);
  }

  return dir;
}

async function wantsImport(app, file, mode) {
  const step = importStep({ mode, app, fileExists: existsSync(file), tty: Boolean(process.stdin.isTTY && process.stdout.isTTY) });
  if (step !== ImportStep.Ask) {
    return step === ImportStep.Import;
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await prompt.question(`feega: import the current folder (${basename(app)}) into the canvas? (Y/n) `)).trim().toLowerCase();
  prompt.close();
  return answer === '' || answer.startsWith('y');
}

async function importFolder(url, folder) {
  const home = await fetch(url, readyProbe);
  const place = placeOf(home.headers.get('location'));
  if (!place) {
    throw new Error('could not find the local canvas');
  }

  console.log(`feega: importing ${basename(folder)} (starts its dev server, can take a minute)…`);
  const { path, body } = importAsk(place, folder);
  const res = await fetch(new URL(path, url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const { error, detail } = await res.json().catch(() => ({}));
    throw new Error(`folder import failed: ${detail ?? error ?? res.status}`);
  }

  const { pages = [] } = await res.json();
  console.log(`feega: imported ${basename(folder)} (${pages.length} pages)`);
}

function forward(child) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('exit', (code) => process.exit(code ?? 0));
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

  const dir = await readyApp();
  if (args.command === 'mcp') {
    serveMcp(dir, args.port);
    return;
  }

  const { file, browser, folderImport } = args;
  const app = folderApp(process.cwd());
  const importing = await wantsImport(app, file, folderImport);
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  void sendTelemetry({
    home: homedir(),
    env: process.env,
    notify: (line) => console.error(line),
    info: { version, platform: process.platform, arch: process.arch, node: process.versions.node }
  });
  const port = await freePort(args.port);

  const url = boundUrl(port);
  console.log(`feega: saving to ${file}`);
  console.log(`feega: open ${url}`);

  const nodeOptions = nodeMajor >= WEBSTORAGE_NODE_MAJOR ? '--no-experimental-webstorage' : '';
  const env = { ...process.env, ...telemetryEnv(homedir(), process.env), NODE_OPTIONS: [process.env.NODE_OPTIONS, nodeOptions].filter(Boolean).join(' ') };
  const server = spawn(process.execPath, [realpathSync(join(dir, 'scripts/local.mjs')), file, `--port=${port}`], { stdio: 'inherit', env });
  forward(server);

  await whenReady(url);
  if (browser === 'open') {
    openBrowser(url);
  }

  if (importing) {
    await importFolder(url, app).catch((error) => console.error(`feega: ${error.message}`));
  }
}

main().catch((error) => {
  console.error(`feega: ${error.message}`);
  process.exit(1);
});
