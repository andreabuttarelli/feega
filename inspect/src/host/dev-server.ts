import { spawn, type ChildProcess } from 'node:child_process';
import { cp, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { devProxy } from './dev-proxy';
import { servesWorkspace } from './listener';
import { Framework, planFile, runPlan, textsWanted, type Planned, type RepoFacts, type RunPlan } from '@feega/dev-run/run-plan';

export enum Launch {
  Vite = 'vite',
  Next = 'next',
  Script = 'script',
  Command = 'command'
}

type LaunchRow = { copiesLauncher: boolean; proxied: boolean };

const LAUNCH_ROWS: Record<Launch, LaunchRow> = {
  [Launch.Vite]: { copiesLauncher: true, proxied: false },
  [Launch.Next]: { copiesLauncher: true, proxied: true },
  [Launch.Script]: { copiesLauncher: true, proxied: true },
  [Launch.Command]: { copiesLauncher: true, proxied: true }
};

const LAUNCH: Record<Framework, Launch> = {
  [Framework.SvelteKit]: Launch.Vite,
  [Framework.Vite]: Launch.Vite,
  [Framework.ReactRouter]: Launch.Vite,
  [Framework.Nuxt]: Launch.Script,
  [Framework.Astro]: Launch.Script,
  [Framework.Next]: Launch.Next,
  [Framework.Gatsby]: Launch.Script,
  [Framework.Angular]: Launch.Script,
  [Framework.Cra]: Launch.Script,
  [Framework.Generic]: Launch.Script
};

export type Running = { url: string; plan: RunPlan; launch: Launch; attached: boolean; pid: number | null; command: string; stop: () => void; exited: (then: () => void) => void };

export enum Attach {
  IfRunning = 'if-running',
  Never = 'never'
}

const HOST = '127.0.0.1';
const LAUNCHER_DIR = 'node_modules/.feega-inspect';
const LAUNCHER = 'launch.mjs';
const NEXT_PRELOAD = 'next-preload.cjs';
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

function started(plan: RunPlan, appRoot: string, launch: Launch, command: string): ChildProcess {
  const env = { ...process.env, ...plan.env };
  if (launch === Launch.Command) {
    return spawn(command, { cwd: appRoot, env: process.env, shell: true });
  }
  if (launch === Launch.Vite) {
    return spawn('node', [join(appRoot, LAUNCHER_DIR, LAUNCHER), String(plan.port), HOST], { cwd: appRoot, env });
  }
  const preload = launch === Launch.Next ? { NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --require ${join(appRoot, LAUNCHER_DIR, NEXT_PRELOAD)}`.trim() } : {};
  const [bin, ...args] = plan.dev;
  return spawn(bin, args, { cwd: appRoot, env: { ...env, ...preload }, shell: process.platform === 'win32' });
}

export async function startDev(root: string, launcherSource: string, log: (line: string) => void, command = '', attach = Attach.IfRunning): Promise<Running | { refused: string }> {
  const planned: Planned = runPlan(await factsOf(root), null, { host: HOST, port: await freePort() });
  if (!planned.ok) {
    return { refused: planned.reason };
  }

  const appRoot = join(root, planned.appDir);
  const launch = command ? Launch.Command : LAUNCH[planned.framework];
  const own = `http://localhost:${planned.defaultPort}/`;
  const row = LAUNCH_ROWS[launch];
  if (row.copiesLauncher) {
    await cp(launcherSource, join(appRoot, LAUNCHER_DIR), { recursive: true });
  }
  const bridgeDir = join(appRoot, LAUNCHER_DIR);
  if (attach === Attach.IfRunning && launch !== Launch.Vite && (await answers(own)) && (await servesWorkspace(planned.defaultPort, appRoot))) {
    const proxy = await devProxy(own, bridgeDir);
    return { url: proxy.url, plan: planned, launch, attached: true, pid: null, command: 'already running', stop: proxy.close, exited: () => undefined };
  }

  const child = started(planned, appRoot, launch, command);
  child.stdout?.on('data', (d) => log(String(d)));
  child.stderr?.on('data', (d) => log(String(d)));

  const url = launch === Launch.Command ? own : `http://${HOST}:${planned.port}/`;
  if (!(await until(url, child))) {
    child.kill();
    return { refused: `the dev server did not answer on ${url}` };
  }
  const shown = launch === Launch.Command ? command : launch === Launch.Vite ? `vite (Feega launcher) on ${planned.port}` : planned.dev.join(' ');
  const proxy = row.proxied ? await devProxy(url, bridgeDir) : null;
  const stop = () => (proxy?.close(), child.kill());
  return { url: proxy?.url ?? url, plan: planned, launch, attached: false, pid: child.pid ?? null, command: shown, stop, exited: (then) => child.once('exit', then) };
}
