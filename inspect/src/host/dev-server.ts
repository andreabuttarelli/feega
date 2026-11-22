import { spawn, type ChildProcess } from 'node:child_process';
import { access, cp, readFile, readdir } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { basename, join } from 'node:path';
import { devProxy } from './dev-proxy';
import { portsServing, servesWorkspace } from './listener';
import { Framework, PlanRefusal, planFile, runPlan, textsWanted, type Planned, type RepoFacts, type RunPlan } from '@feega/dev-run/run-plan';
import { attachRefusal } from '@feega/dev-run/attach-rule';
import { DepsOutcome, depsMissing, ensureDeps } from './deps';
import { failureOf, localUrlOf, type Failed } from './dev-output';
import { killTree } from './process-tree';
import { Launch } from './launch';
import { Verdict, verdictOf } from './candidate';
import { until, type Probes, type Watched } from './ready';
import { stampedDev } from './stamped-dev';
import { commandShown } from './server-info';

export { Launch };

type LaunchRow = { copiesLauncher: boolean; proxied: boolean; attaches: boolean };

const LAUNCH_ROWS: Record<Launch, LaunchRow> = {
  [Launch.Vite]: { copiesLauncher: true, proxied: false, attaches: true },
  [Launch.Next]: { copiesLauncher: true, proxied: true, attaches: true },
  [Launch.Script]: { copiesLauncher: true, proxied: true, attaches: true },
  [Launch.Command]: { copiesLauncher: true, proxied: true, attaches: false }
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
const SKIPPED_DIRS = new Set(['node_modules', '.git', '.claude', '.svelte-kit', '.next', '.output', 'dist', 'build', '__fixtures__', 'fixtures']);
const MAX_DEPTH = 4;
const READY_MS = 120_000;
const POLL_MS = 500;
const READY_POLL_MS = 100;

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


const LOOPBACKS = ['127.0.0.1', '::1'];

const accepts = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host, port });
    const done = (ok: boolean) => (socket.destroy(), resolve(ok));
    socket.setTimeout(POLL_MS, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });

export async function listening(port: number): Promise<boolean> {
  const all = await Promise.all(LOOPBACKS.map((h) => accepts(h, port)));
  return all.some(Boolean);
}

export function watchOutput(child: ChildProcess): Watched {
  const seen: Watched = { url: null, failed: null };
  const read = (d: Buffer) => {
    const text = String(d);
    seen.url ??= localUrlOf(text);
    seen.failed ??= failureOf(text);
  };
  child.stdout?.on('data', read);
  child.stderr?.on('data', read);
  return seen;
}

const KILL_AFTER_MS = 3000;

export function stopGroup(child: ChildProcess) {
  const pid = child.pid;
  if (!pid || child.exitCode !== null) {
    return;
  }
  const signal = (sig: NodeJS.Signals) => killTree(pid, sig);
  signal('SIGTERM');
  setTimeout(() => child.exitCode === null && signal('SIGKILL'), KILL_AFTER_MS).unref();
}

const has = (path: string) => access(path).then(() => true, () => false);

export type StartHooks = { log: (line: string) => void; installing: (app: string) => void; spawned: (pid: number) => void; declined: (text: string) => void; signal: AbortSignal };

function install(dir: string, argv: string[], hooks: StartHooks): Promise<DepsOutcome | Failed> {
  const [bin, ...args] = argv;
  const child = spawn(bin, args, { cwd: dir, env: process.env, detached: process.platform !== 'win32', shell: process.platform === 'win32' });
  const seen = watchOutput(child);
  let last = '';
  const log = (d: Buffer) => ((last = String(d).trim().split('\n').at(-1) || last), hooks.log(String(d)));
  child.stdout?.on('data', log);
  child.stderr?.on('data', log);
  const cancel = () => stopGroup(child);
  hooks.signal.addEventListener('abort', cancel, { once: true });
  return new Promise((resolve) => {
    child.once('error', (e) => resolve({ ...(failureOf(`${e.message}`) ?? { failure: 'missing-deps', message: 'The install could not start', action: 'show-logs' }), line: e.message } as Failed));
    child.once('exit', (code) => {
      hooks.signal.removeEventListener('abort', cancel);
      if (hooks.signal.aborted) {
        return resolve(DepsOutcome.Cancelled);
      }
      resolve(code === 0 ? DepsOutcome.Installed : (seen.failed ?? ({ failure: 'missing-deps', line: last || `install exited with ${code}`, message: 'The install failed', action: 'show-logs' } as Failed)));
    });
  });
}

const GROUPED = process.platform !== 'win32';

function started(plan: RunPlan, appRoot: string, launch: Launch, command: string): ChildProcess {
  const env = { ...process.env, ...plan.env };
  if (launch === Launch.Command) {
    return spawn(command, { cwd: appRoot, env: process.env, shell: true, detached: GROUPED });
  }
  if (launch === Launch.Vite) {
    return spawn('node', [join(appRoot, LAUNCHER_DIR, LAUNCHER), String(plan.port), HOST], { cwd: appRoot, env, detached: GROUPED });
  }
  const preload = launch === Launch.Next ? { NODE_OPTIONS: `${env.NODE_OPTIONS ?? ''} --require ${join(appRoot, LAUNCHER_DIR, NEXT_PRELOAD)}`.trim() } : {};
  const [bin, ...args] = stampedDev(plan.framework, plan, join(appRoot, LAUNCHER_DIR), HOST) ?? plan.dev;
  return spawn(bin, args, { cwd: appRoot, env: { ...env, ...preload }, shell: process.platform === 'win32', detached: GROUPED });
}

export type Refused = { refused: string; apps?: string[]; failed?: Failed; attachRefused?: true };

const spawnedPids = new Set<number>();

const loopbackUrl = (port: number) => `http://localhost:${port}/`;

async function pageOf(url: string): Promise<string | null> {
  const reply = await fetch(url, { signal: AbortSignal.timeout(POLL_MS * 4) }).catch(() => null);
  return reply ? reply.text().catch(() => '') : null;
}

const SKIP_NOTE: Partial<Record<Verdict, string>> = {
  [Verdict.Silent]: 'does not answer',
  [Verdict.FeegaServer]: 'is a Feega server',
  [Verdict.OtherProject]: 'does not serve this project'
};

async function userServer(appRoot: string, launch: Launch, framework: Framework, defaultPort: number, hooks: StartHooks): Promise<string | null> {
  if (!LAUNCH_ROWS[launch].attaches) {
    return null;
  }
  const found = await portsServing(appRoot, undefined, spawnedPids);
  const ports = found.length || !(await servesWorkspace(defaultPort, appRoot)) ? found : [defaultPort];
  for (const port of ports) {
    const url = loopbackUrl(port);
    const verdict = await verdictOf(url, appRoot, launch);
    const declined = attachRefusal(framework);
    if (verdict === Verdict.Ours && declined) {
      hooks.log(`feega: not attaching to ${url}: ${declined}\n`);
      hooks.declined(declined);
      continue;
    }
    if (verdict === Verdict.Ours) {
      hooks.log(`feega: attaching to the dev server already running on ${url}\n`);
      return url;
    }
    hooks.log(`feega: not attaching to ${url}: it ${SKIP_NOTE[verdict]}\n`);
  }
  return null;
}

async function attachedTo(url: string, plan: RunPlan, appRoot: string, launcherSource: string): Promise<Running> {
  const bridgeDir = join(appRoot, LAUNCHER_DIR);
  await cp(launcherSource, bridgeDir, { recursive: true });
  const proxy = await devProxy(url, bridgeDir);
  return { url: proxy.url, plan, launch: LAUNCH[plan.framework], attached: true, pid: null, command: `already running on ${url}`, stop: proxy.close, exited: () => undefined };
}

export async function attachDev(root: string, launcherSource: string, url: string, asked: string | null): Promise<Running | Refused> {
  if ((await pageOf(url)) === null) {
    return { refused: `nothing answers on ${url}` };
  }
  const planned: Planned = runPlan(await factsOf(root), asked, { host: HOST, port: await freePort() });
  if (!planned.ok) {
    return { refused: planned.reason };
  }
  const declined = attachRefusal(planned.framework);
  if (declined) {
    return { refused: declined, attachRefused: true };
  }
  return attachedTo(url, planned, join(root, planned.appDir), launcherSource);
}

function timeline(log: (line: string) => void) {
  const begun = Date.now();
  let last = begun;
  const marks: string[] = [];
  return {
    mark: (stage: string) => {
      const now = Date.now();
      marks.push(`${stage} ${now - last}ms`);
      last = now;
    },
    done: (how: string) => log(`feega timeline (${how}): ${marks.join(', ')}, total ${Date.now() - begun}ms\n`)
  };
}

export async function startDev(root: string, launcherSource: string, hooks: StartHooks, command = '', attach = Attach.IfRunning, asked: string | null = null): Promise<Running | Refused> {
  const time = timeline(hooks.log);
  const planned: Planned = runPlan(await factsOf(root), asked, { host: HOST, port: await freePort() });
  time.mark('plan');
  if (!planned.ok) {
    return { refused: planned.reason, apps: planned.refusal === PlanRefusal.ChooseApp ? planned.apps : undefined };
  }

  const appRoot = join(root, planned.appDir);
  const launch = command ? Launch.Command : LAUNCH[planned.framework];
  const row = LAUNCH_ROWS[launch];
  const bridgeDir = join(appRoot, LAUNCHER_DIR);
  const theirs = attach === Attach.IfRunning ? await userServer(appRoot, launch, planned.framework, planned.defaultPort, hooks) : null;
  time.mark('look for a running server');
  if (theirs) {
    const attached = await attachedTo(theirs, planned, appRoot, launcherSource);
    time.done('attached');
    return attached;
  }

  const installed: { failed: Failed | null } = { failed: null };
  if (launch !== Launch.Command) {
    const deps = await ensureDeps({
      missing: () => depsMissing(appRoot, root, planned.framework, has),
      install: async () => {
        hooks.installing(planned.appDir || basename(root));
        const out = await install(join(root, planned.installDir), planned.install, hooks);
        return typeof out === 'string' ? out : ((installed.failed = out), DepsOutcome.Failed);
      }
    });
    if (deps === DepsOutcome.Cancelled) {
      return { refused: 'install cancelled' };
    }
    if (deps === DepsOutcome.Failed) {
      return { refused: installed.failed?.line ?? 'the install failed', failed: installed.failed ?? undefined };
    }
  }
  time.mark('deps');
  if (row.copiesLauncher) {
    await cp(launcherSource, bridgeDir, { recursive: true });
  }

  const child = started(planned, appRoot, launch, command);
  const pid = child.pid;
  if (pid) {
    spawnedPids.add(pid);
    child.once('exit', () => spawnedPids.delete(pid));
    hooks.spawned(pid);
  }
  const seen = watchOutput(child);
  child.stdout?.on('data', (d) => hooks.log(String(d)));
  child.stderr?.on('data', (d) => hooks.log(String(d)));

  const port = launch === Launch.Command ? planned.defaultPort : planned.port;
  const owned = launch === Launch.Command ? listening : (p: number) => servesWorkspace(p, appRoot);
  const ready = await until(port, child, seen, { listening, ours: owned, wait: () => new Promise((r) => setTimeout(r, READY_POLL_MS)), now: Date.now, timeoutMs: READY_MS });
  time.mark('ready');
  if (typeof ready !== 'string') {
    stopGroup(child);
    return ready ? { refused: `${ready.message}: ${ready.line}`, failed: ready } : { refused: child.exitCode !== null ? `the dev server exited (${child.exitCode})` : `the dev server did not answer on port ${port}` };
  }
  hooks.log(`feega: started the dev server on ${ready}\n`);
  const shown = launch === Launch.Command ? command : launch === Launch.Vite ? 'vite (Feega launcher)' : commandShown(planned.dev, planned.port);
  const proxy = row.proxied ? await devProxy(ready, bridgeDir) : null;
  const stop = () => (proxy?.close(), stopGroup(child));
  time.done('started');
  return { url: proxy?.url ?? ready, plan: planned, launch, attached: false, pid: child.pid ?? null, command: shown, stop, exited: (then) => child.once('exit', then) };
}
