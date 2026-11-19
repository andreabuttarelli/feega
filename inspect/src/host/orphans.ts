import { execFile } from 'node:child_process';
import { Stored } from './platform';

export type Memo = { get: <T>(key: string) => T | undefined; update: (key: string, value: unknown) => Thenable<void> | Promise<void> };
type Tracked = { pid: number; app: string };
export type Processes = { command: (pid: number) => Promise<string>; kill: (pid: number) => void };

const KEY = Stored.Pids;

const tracked = (memo: Memo) => memo.get<Tracked[]>(KEY) ?? [];

export const remember = (memo: Memo, pid: number, app: string) => memo.update(KEY, [...tracked(memo).filter((t) => t.pid !== pid), { pid, app }]);

export const forget = (memo: Memo, pid: number) => memo.update(KEY, tracked(memo).filter((t) => t.pid !== pid));

const SYSTEM: Processes = {
  command: (pid) => new Promise((resolve) => execFile('ps', ['-o', 'command=', '-p', String(pid)], (_e, out) => resolve(String(out ?? '').trim()))),
  kill: (pid) => {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      return;
    }
  }
};

export async function killOrphans(memo: Memo, processes: Processes = SYSTEM): Promise<void> {
  const all = tracked(memo);
  for (const { pid, app } of all) {
    if (app && (await processes.command(pid)).includes(app)) {
      processes.kill(pid);
    }
  }
  await memo.update(KEY, []);
}
