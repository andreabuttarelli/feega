import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

const DEFAULT_FILE = 'canvas.feega';
const DEFAULT_PORT = 0;
export const LOOPBACK = '127.0.0.1';
export const MCP_PORT = 5173;
export const MCP_ENTRY = 'mcp.mjs';
export const USAGE = `usage: feega [file.feega] [--port <n>] [--no-open] [--import | --no-import] [--help] [--version]
       feega mcp [--port <n>]   MCP server (stdio) for the local feega on that port (default ${MCP_PORT})`;
export const FolderImport = { Ask: 'ask', Yes: 'yes', No: 'no' };
export const ImportStep = { Ask: 'ask', Import: 'import', Skip: 'skip' };

const IMPORT_FLAGS = { '--import': FolderImport.Yes, '--no-import': FolderImport.No };
const HOME_ROUTE = '/';
const PLACE = /\/p\/([^/]+)\/c\/([^/?#]+)/;

const CACHED_MARKER = '.complete';
const APP_TAG = 'app-v';
const RELEASES = 'https://github.com/andreabuttarelli/feega/releases/download';
export const BUNDLE_NAME = 'feega-app.tar.gz';

const portOf = (raw) => {
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`invalid --port: ${raw}`);
  }

  return port;
};

const portFlag = (arg, rest) => {
  if (arg === '--port') {
    return portOf(rest.shift());
  }

  if (arg.startsWith('--port=')) {
    return portOf(arg.slice('--port='.length));
  }

  return null;
};

function parseMcp(rest) {
  let port = MCP_PORT;
  while (rest.length) {
    const arg = rest.shift();
    const flagged = portFlag(arg, rest);
    if (flagged === null) {
      throw new Error(`unknown option: ${arg}\n${USAGE}`);
    }

    port = flagged;
  }

  return { command: 'mcp', port };
}

export const mcpEnv = (port, env) => ({ ...env, PUBLIC_APP_URL: boundUrl(port) });

export function parseArgs(argv, cwd) {
  const rest = [...argv];
  if (rest[0] === 'mcp') {
    return parseMcp(rest.slice(1));
  }

  const files = [];
  let port = DEFAULT_PORT;
  let browser = 'open';
  let folderImport = FolderImport.Ask;

  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--help' || arg === '-h') {
      return { command: 'help' };
    }

    if (arg === '--version') {
      return { command: 'version' };
    }

    if (arg === '--no-open') {
      browser = 'skip';
      continue;
    }

    if (IMPORT_FLAGS[arg]) {
      folderImport = IMPORT_FLAGS[arg];
      continue;
    }

    const flagged = portFlag(arg, rest);
    if (flagged !== null) {
      port = flagged;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}\n${USAGE}`);
    }

    files.push(arg);
  }

  return { command: 'run', file: resolve(cwd, files[0] ?? DEFAULT_FILE), port, browser, folderImport };
}

export const appDir = (home, version) => join(home, '.feega', 'app', version);

export const isCached = (dir) => existsSync(join(dir, CACHED_MARKER));

export function markCached(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CACHED_MARKER), '');
}

export const bundleSource = (version, env) => env.FEEGA_APP_BUNDLE ?? `${RELEASES}/${APP_TAG}${version}/${BUNDLE_NAME}`;

const semver = (v) => v.split('.').map(Number);

const newestFirst = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  const diff = x.map((n, i) => y[i] - n).find((d) => d !== 0);
  return diff ?? 0;
};

export function latestAppVersion(releases) {
  const versions = releases
    .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(APP_TAG))
    .map((r) => r.tag_name.slice(APP_TAG.length));
  return versions.sort(newestFirst)[0] ?? null;
}

export function cachedVersions(home) {
  const root = join(home, '.feega', 'app');
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root)
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v) && isCached(join(root, v)))
    .sort(newestFirst);
}

export function pickVersion(latest, cached) {
  if (latest) {
    return { version: latest, action: cached.includes(latest) ? 'cache' : 'download' };
  }

  if (!cached.length) {
    throw new Error('offline and no cached app: connect once to download it');
  }

  return { version: cached[0], action: 'cache' };
}

export const boundUrl = (port) => `http://${LOOPBACK}:${port}`;

export const freePort = (port) =>
  new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(port, LOOPBACK, () => {
      const { port: bound } = probe.address();
      probe.close(() => done(bound));
    });
  });

export function folderApp(dir) {
  const manifest = join(dir, 'package.json');
  if (!existsSync(manifest)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(manifest, 'utf8')).scripts?.dev ? dir : null;
  } catch {
    return null;
  }
}

const STEPS = {
  [FolderImport.No]: () => ImportStep.Skip,
  [FolderImport.Yes]: () => ImportStep.Import,
  [FolderImport.Ask]: ({ fileExists, tty }) => (!fileExists && tty ? ImportStep.Ask : ImportStep.Skip)
};

export function importStep({ mode, app, fileExists, tty }) {
  if (!app) {
    return ImportStep.Skip;
  }

  return STEPS[mode]({ fileExists, tty });
}

export function placeOf(location) {
  const found = PLACE.exec(location ?? '');
  return found ? { projectId: found[1], canvasId: found[2] } : null;
}

export const importAsk = (place, folder) => ({
  path: `/api/v1/projects/${place.projectId}/code-import`,
  body: { canvasId: place.canvasId, folder, routes: [HOME_ROUTE], x: 0, y: 0 }
});

const HTTP_ERROR_MIN = 400;

export const readyProbe = { redirect: 'manual' };

export const served = (status) => status < HTTP_ERROR_MIN;
