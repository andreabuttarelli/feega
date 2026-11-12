import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { isAbsolute, join, normalize, relative } from 'node:path';
import { promisify } from 'node:util';
import { namesIn } from './repo';
import { planFile, runPlan, textsWanted, type PlanRefused, type RepoFacts, type RunPlan } from './run-plan';
import type { FileChange, ReadFile } from './write-back';
import type { CodeSource, Published } from './code-source';

const run = promisify(execFile);

const SKIPPED_DIRS = new Set(['node_modules', '.git', '.svelte-kit', '.next', 'dist', 'build', '.vercel', '.turbo']);
const WATCHED = /\.(svelte|vue|tsx|jsx|ts|js|html|css|json)$/;
const COMPONENT_FILE = /\.(tsx|jsx)$/;
const MAX_FILES = 4_000;
const READY_MS = 90_000;
const POLL_MS = 500;
const HTTP_OK_MAX = 399;
const LOOPBACK = '127.0.0.1';

export function folderOf(raw: string): string | null {
  const path = normalize(raw.trim());
  return isAbsolute(path) && existsSync(join(path, 'package.json')) && statSync(path).isDirectory() ? path : null;
}

const inside = (root: string, path: string) => {
  const full = normalize(join(root, path));
  const rel = relative(root, full);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? full : null;
};

const watched = (name: string) => WATCHED.test(name);

async function walk(root: string, dir = root, out: string[] = [], keep = watched): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (out.length >= MAX_FILES) {
      break;
    }
    if (entry.isDirectory() && !SKIPPED_DIRS.has(entry.name)) {
      await walk(root, join(dir, entry.name), out, keep);
    } else if (entry.isFile() && keep(entry.name)) {
      out.push(relative(root, join(dir, entry.name)));
    }
  }
  return out;
}

export async function folderHead(root: string): Promise<string> {
  const hash = createHash('sha1');
  for (const file of (await walk(root)).sort()) {
    const s = await stat(join(root, file));
    hash.update(`${file}:${s.size}:${s.mtimeMs}\n`);
  }
  return hash.digest('hex');
}

const reader =
  (root: string): ReadFile =>
  async (path) => {
    const full = inside(root, path);
    return full ? readFile(full, 'utf8').catch(() => null) : null;
  };

const git = (root: string, args: string[], env: Record<string, string> = {}) => run('git', args, { cwd: root, env: { ...process.env, ...env } }).then((r) => r.stdout.trim());

async function committed(root: string, files: FileChange[], branch: string, message: string): Promise<boolean> {
  if (!existsSync(join(root, '.git'))) {
    return false;
  }
  const dir = await mkdtemp(join(tmpdir(), 'feega-index-'));
  const index = { GIT_INDEX_FILE: join(dir, 'index') };
  try {
    await git(root, ['read-tree', 'HEAD'], index);
    for (const file of files) {
      const blob = await git(root, ['hash-object', '-w', file.path]);
      await git(root, ['update-index', '--add', '--cacheinfo', `100644,${blob},${file.path}`], index);
    }
    const tree = await git(root, ['write-tree'], index);
    const commit = await git(root, ['commit-tree', tree, '-p', 'HEAD', '-m', message]);
    await git(root, ['branch', branch, commit]);
    return true;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function published(root: string, files: FileChange[], branch: string, title: string): Promise<Published | null> {
  const targets = files.map((f) => ({ file: f, full: inside(root, f.path) }));
  if (targets.some((t) => !t.full)) {
    return null;
  }
  for (const { file, full } of targets) {
    await writeFile(full!, file.after, 'utf8');
  }
  const onBranch = await committed(root, files, branch, title).catch(() => false);
  return { url: null, branch: onBranch ? branch : null, files: files.map((f) => f.path) };
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, LOOPBACK, () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

type Served = { url: string; child: ChildProcess };

const serving = new Map<string, Promise<Served>>();

async function ready(url: string): Promise<boolean> {
  const until = Date.now() + READY_MS;
  while (Date.now() < until) {
    const res = await fetch(url).catch(() => null);
    if (res && res.status <= HTTP_OK_MAX) {
      return true;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

async function factsAt(root: string): Promise<RepoFacts> {
  const files = await walk(root, root, [], planFile);
  const texts = await Promise.all(textsWanted(files).map(async (f) => [f, await readFile(join(root, f), 'utf8').catch(() => '')] as const));
  return { files, texts: Object.fromEntries(texts) };
}

async function started(dir: string, plan: RunPlan): Promise<Served> {
  const [cmd, ...args] = plan.dev;
  const child = spawn(cmd, args, { cwd: dir, env: { ...process.env, ...plan.env }, stdio: 'ignore' });
  const url = `http://${LOOPBACK}:${plan.port}`;
  if (!(await ready(url))) {
    child.kill();
    throw new Error(`the dev server in ${dir} did not answer on ${url}`);
  }
  child.once('exit', () => serving.delete(dir));
  return { url, child };
}

export async function devServerOf(root: string, app: string | null): Promise<Served | PlanRefused> {
  const plan = runPlan(await factsAt(root), app, { host: LOOPBACK, port: await freePort() });
  if (!plan.ok) {
    return plan;
  }

  const dir = join(root, plan.appDir);
  const known = serving.get(dir);
  if (known) {
    return known;
  }
  const next = started(dir, plan).catch((e: unknown) => {
    serving.delete(dir);
    throw e;
  });
  serving.set(dir, next);
  return next;
}

export async function folderNames(root: string): Promise<string[]> {
  const files = (await walk(root)).filter((f) => COMPONENT_FILE.test(f));
  const sources = await Promise.all(files.map((f) => readFile(join(root, f), 'utf8').catch(() => '')));
  return namesIn(sources.join('\n'));
}

export function folderSource(root: string): CodeSource {
  return {
    read: () => reader(root),
    head: () => folderHead(root),
    publish: (_base, files, ask) => published(root, files, ask.branch, ask.title)
  };
}
