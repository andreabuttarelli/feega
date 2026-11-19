import { spawn, type ChildProcess } from 'node:child_process';
import { cp, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { Framework, planFile, runPlan, textsWanted, type Planned, type RepoFacts, type RunPlan } from '@feega/dev-run/run-plan';

export enum Launch {
  Vite = 'vite',
  Script = 'script'
}

const LAUNCH: Record<Framework, Launch> = {
  [Framework.SvelteKit]: Launch.Vite,
  [Framework.Vite]: Launch.Vite,
  [Framework.ReactRouter]: Launch.Vite,
  [Framework.Nuxt]: Launch.Script,
  [Framework.Astro]: Launch.Script,
  [Framework.Next]: Launch.Script,
  [Framework.Gatsby]: Launch.Script,
  [Framework.Angular]: Launch.Script,
  [Framework.Cra]: Launch.Script,
  [Framework.Generic]: Launch.Script
};

export type Running = { url: string; plan: RunPlan; launch: Launch; attached: boolean; stop: () => void };

const HOST = '127.0.0.1';
const LAUNCHER_DIR = 'node_modules/.feega-inspect';
const LAUNCHER = 'launch.mjs';
const SKIPPED_DIRS = new Set(['node_modules', '.git', '.svelte-kit', '.next', 'dist', 'build']);
const MAX_DEPTH = 4;
const READY_MS = 120_000;
const POLL_MS = 500;

async function filesUnder(root: string, dir = '', depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) {
    return [];
  }
  const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map((e) => {
      const path = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        return SKIPPED_DIRS.has(e.name) ? [] : filesUnder(root, path, depth + 1);
      }
      return [path];
    })
  );
  return nested.flat();
}

export async function factsOf(root: string): Promise<RepoFacts> {
  const files = (await filesUnder(root)).filter(planFile);
  const texts = Object.fromEntries(await Promise.all(textsWanted(files).map(async (f) => [f, await readFile(join(root, f), 'utf8')] as const)));
  return { files, texts };
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, HOST, () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

const answers = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(POLL_MS * 4) })
    .then(() => true)
    .catch(() => false);

async function until(url: string, child: ChildProcess): Promise<boolean> {
  const end = Date.now() + READY_MS;
  while (Date.now() < end && child.exitCode === null) {
    if (await answers(url)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

function started(plan: RunPlan, appRoot: string, launch: Launch): ChildProcess {
  const env = { ...process.env, ...plan.env };
  if (launch === Launch.Vite) {
    return spawn('node', [join(appRoot, LAUNCHER_DIR, LAUNCHER), String(plan.port), HOST], { cwd: appRoot, env });
  }
  const [bin, ...args] = plan.dev;
  return spawn(bin, args, { cwd: appRoot, env, shell: process.platform === 'win32' });
}

export async function startDev(root: string, launcherSource: string, log: (line: string) => void): Promise<Running | { refused: string }> {
  const planned: Planned = runPlan(await factsOf(root), null, { host: HOST, port: await freePort() });
  if (!planned.ok) {
    return { refused: planned.reason };
  }

  const appRoot = join(root, planned.appDir);
  const launch = LAUNCH[planned.framework];
  const own = `http://localhost:${planned.defaultPort}/`;
  if (launch === Launch.Script && (await answers(own))) {
    return { url: own, plan: planned, launch, attached: true, stop: () => undefined };
  }

  if (launch === Launch.Vite) {
    await cp(launcherSource, join(appRoot, LAUNCHER_DIR), { recursive: true });
  }
  const child = started(planned, appRoot, launch);
  child.stdout?.on('data', (d) => log(String(d)));
  child.stderr?.on('data', (d) => log(String(d)));

  const url = `http://${HOST}:${planned.port}/`;
  if (!(await until(url, child))) {
    child.kill();
    return { refused: `the dev server did not answer on ${url}` };
  }
  return { url, plan: planned, launch, attached: false, stop: () => child.kill() };
}
