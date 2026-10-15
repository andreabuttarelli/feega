import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const WEB = join(ROOT, 'src/routes');
const NATIVE = join(ROOT, 'src/native-routes');
const NATIVE_ROUTES = join(ROOT, '.native/routes');
const OUT = join(ROOT, 'apps/native/bundle-dist');
const STATIC = join(ROOT, 'static');
const NATIVE_STATIC = join(ROOT, '.native/static');
const BUNDLED_STATIC = JSON.parse(readFileSync(join(ROOT, 'src/lib/native/bundled-static.json'), 'utf8'));
const DEFAULT_API = 'https://oh.feega.app';

const WEB_FILES = ['+error.svelte', 'app/+layout.svelte', 'app/+layout.ts', 'app/+page.svelte', 'app/+page.ts', 'app/tools/+page.svelte'];
const DASHBOARD_PAGES = ['canvases', 'templates', 'motion', 'credits'];
const PAGE_FILES = ['+page.svelte', '+page.ts'];
const ENTRY_PATHS = ['app', 'app/tools', 'login', 'auth/callback', ...DASHBOARD_PAGES.map((page) => `app/${page}`)];

function copy(from, to) {
  if (!existsSync(from)) {
    throw new Error(`native bundle: missing ${from}`);
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

function assembleRoutes() {
  rmSync(NATIVE_ROUTES, { recursive: true, force: true });
  for (const file of WEB_FILES) {
    copy(join(WEB, file), join(NATIVE_ROUTES, file));
  }
  for (const page of DASHBOARD_PAGES) {
    for (const file of PAGE_FILES) {
      copy(join(WEB, 'app', page, file), join(NATIVE_ROUTES, 'app', page, file));
    }
  }
  cpSync(NATIVE, NATIVE_ROUTES, { recursive: true });
}

function assembleStatic() {
  rmSync(NATIVE_STATIC, { recursive: true, force: true });
  for (const entry of BUNDLED_STATIC) {
    copy(join(STATIC, entry), join(NATIVE_STATIC, entry));
  }
}

function build() {
  rmSync(OUT, { recursive: true, force: true });
  const env = {
    ...process.env,
    FEEGA_TARGET: 'bundle',
    PUBLIC_FEEGA_RUNTIME: 'bundle',
    PUBLIC_API_BASE: process.env.FEEGA_API ?? DEFAULT_API
  };
  const run = spawnSync('npx', ['vite', 'build'], { cwd: ROOT, env, stdio: 'inherit' });
  if (run.status !== 0) {
    process.exit(run.status ?? 1);
  }
}

function entryPerRoute() {
  for (const path of ENTRY_PATHS) {
    copy(join(OUT, 'index.html'), join(OUT, path, 'index.html'));
  }
}

assembleRoutes();
assembleStatic();
build();
entryPerRoute();
