import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HAS_LSOF = process.platform !== 'win32';

export type CwdOf = (port: number) => Promise<string | null>;

const field = (out: string, tag: string) =>
  out
    .split('\n')
    .find((l) => l.startsWith(tag))
    ?.slice(1) ?? null;

export const listenerCwd: CwdOf = async (port) => {
  if (!HAS_LSOF) {
    return null;
  }
  try {
    const { stdout: pids } = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp']);
    const pid = field(pids, 'p');
    if (!pid) {
      return null;
    }
    const { stdout } = await run('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']);
    const cwd = field(stdout, 'n');
    return cwd ? await realpath(cwd).catch(() => cwd) : null;
  } catch {
    return null;
  }
};

export async function servesWorkspace(port: number, appRoot: string, cwdOf: CwdOf = listenerCwd): Promise<boolean> {
  const cwd = await cwdOf(port);
  if (!cwd) {
    return false;
  }
  const root = await realpath(appRoot).catch(() => appRoot);
  return cwd === root || cwd.startsWith(root + sep);
}

export type Lsof = { listening: () => Promise<string>; cwds: (pids: number[]) => Promise<string> };

const SYSTEM_LSOF: Lsof = {
  listening: () => (!HAS_LSOF ? Promise.resolve('') : run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']).then((r) => r.stdout, () => '')),
  cwds: (pids) => run('lsof', ['-a', '-p', pids.join(','), '-d', 'cwd', '-Fpn']).then((r) => r.stdout, () => '')
};

function byPid(out: string): [number, string][] {
  let pid = 0;
  const rows: [number, string][] = [];
  for (const line of out.split('\n')) {
    if (line.startsWith('p')) {
      pid = Number(line.slice(1));
      continue;
    }
    if (line.startsWith('n')) {
      rows.push([pid, line.slice(1)]);
    }
  }
  return rows;
}

const within = (dir: string, root: string) => dir === root || dir.startsWith(root + sep);

export async function portsServing(appRoot: string, lsof: Lsof = SYSTEM_LSOF, own: ReadonlySet<number>): Promise<number[]> {
  const ports = byPid(await lsof.listening())
    .filter(([pid]) => pid !== process.pid && !own.has(pid))
    .map(([pid, addr]) => [pid, Number(addr.slice(addr.lastIndexOf(':') + 1))] as const);
  if (!ports.length) {
    return [];
  }
  const root = await realpath(appRoot).catch(() => appRoot);
  const cwds = new Map(byPid(await lsof.cwds([...new Set(ports.map(([pid]) => pid))])));
  const mine = ports.filter(([pid]) => within(cwds.get(pid) ?? '', root)).map(([, port]) => port);
  return [...new Set(mine)];
}
