import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_FILE = 'canvas.feega';
const DEFAULT_PORT = 5173;
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

export function parseArgs(argv, cwd) {
  const rest = [...argv];
  const files = [];
  let port = DEFAULT_PORT;
  let browser = 'open';

  while (rest.length) {
    const arg = rest.shift();
    if (arg === '--no-open') {
      browser = 'skip';
      continue;
    }

    if (arg === '--port') {
      port = portOf(rest.shift());
      continue;
    }

    if (arg.startsWith('--port=')) {
      port = portOf(arg.slice('--port='.length));
      continue;
    }

    files.push(arg);
  }

  return { file: resolve(cwd, files[0] ?? DEFAULT_FILE), port, browser };
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
