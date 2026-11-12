import { execFileSync, spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LEFTOVERS_DIR = join(tmpdir(), 'feega-dev-children');
const STOP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
const REGISTRY = Symbol.for('feega.devChildren');
const STOP_GRACE_MS = 2_000;

type Leftover = { pid: number; started: string; owner: number; ownerStarted: string };

type Registry = { groups: Set<number>; hooked: boolean; reaped: boolean };

type Owner = { ownerAlive: (pid: number, started: string) => boolean };

const held = globalThis as typeof globalThis & { [REGISTRY]?: Registry };
const registry: Registry = (held[REGISTRY] ??= { groups: new Set(), hooked: false, reaped: false });

function startedAt(pid: number): string | null {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

const leftoverFile = (pid: number) => join(LEFTOVERS_DIR, `${pid}.json`);

function killGroup(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pid, signal);
  } catch {
    return;
  }
}

function forget(pid: number) {
  registry.groups.delete(pid);
  rmSync(leftoverFile(pid), { force: true });
}

export function stopGroup(pid: number): void {
  killGroup(pid, 'SIGTERM');
  setTimeout(() => killGroup(pid, 'SIGKILL'), STOP_GRACE_MS).unref();
  forget(pid);
}

export function stopDevChildren(): void {
  for (const pid of [...registry.groups]) {
    killGroup(pid, 'SIGKILL');
    forget(pid);
  }
}

function onStopSignal(signal: NodeJS.Signals) {
  stopDevChildren();
  if (process.listenerCount(signal) > 1) {
    return;
  }
  process.removeListener(signal, onStopSignal);
  process.kill(process.pid, signal);
}

function hookOnce() {
  if (registry.hooked) {
    return;
  }
  registry.hooked = true;
  process.once('exit', stopDevChildren);
  for (const signal of STOP_SIGNALS) {
    process.on(signal, onStopSignal);
  }
}

const ownerAlive = (pid: number, started: string) => startedAt(pid) === started;

export function reapLeftovers(owner: Owner = { ownerAlive }): void {
  let names: string[];
  try {
    names = readdirSync(LEFTOVERS_DIR);
  } catch {
    return;
  }
  for (const name of names) {
    const path = join(LEFTOVERS_DIR, name);
    const left = JSON.parse(readFileSync(path, 'utf8')) as Leftover;
    if (owner.ownerAlive(left.owner, left.ownerStarted)) {
      continue;
    }
    if (startedAt(left.pid) === left.started) {
      killGroup(left.pid, 'SIGKILL');
    }
    rmSync(path, { force: true });
  }
}

function remember(pid: number) {
  const started = startedAt(pid);
  const ownerStarted = startedAt(process.pid);
  if (!started || !ownerStarted) {
    return;
  }
  mkdirSync(LEFTOVERS_DIR, { recursive: true });
  const left: Leftover = { pid, started, owner: process.pid, ownerStarted };
  writeFileSync(leftoverFile(pid), JSON.stringify(left));
}

export function spawnGroup(cmd: string, args: string[], options: SpawnOptions): ChildProcess {
  if (!registry.reaped) {
    registry.reaped = true;
    reapLeftovers();
  }
  hookOnce();

  const child = spawn(cmd, args, { ...options, detached: true });
  const pid = child.pid;
  if (pid === undefined) {
    return child;
  }
  registry.groups.add(pid);
  remember(pid);
  child.once('exit', () => stopGroup(pid));
  return child;
}
