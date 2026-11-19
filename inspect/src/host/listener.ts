import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { sep } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type CwdOf = (port: number) => Promise<string | null>;

const field = (out: string, tag: string) =>
  out
    .split('\n')
    .find((l) => l.startsWith(tag))
    ?.slice(1) ?? null;

export const listenerCwd: CwdOf = async (port) => {
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
