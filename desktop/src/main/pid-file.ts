import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { commandLineOf, killTree } from '../../../inspect/src/host/process-tree';

export type Started = { pid: number; command: string };

export type PidFile = {
  add: (started: Started) => void;
  remove: (pid: number) => void;
  sweep: () => number[];
};

const commandOf = (pid: number): string => {
  const [bin, args] = commandLineOf(pid);
  try {
    return execFileSync(bin, args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const QUOTES = /"/g;

const sameCommand = (a: string, b: string) => a.replace(QUOTES, '').trim() === b.replace(QUOTES, '').trim();

const killGroup = (pid: number) => killTree(pid, 'SIGKILL');

export function pidFile(userData: string, read: (pid: number) => string = commandOf): PidFile {
  const path = join(userData, 'pids.json');

  const load = (): Started[] => {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return [];
    }
  };

  const save = (all: Started[]) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(all));
  };

  return {
    add: (started) => save([...load().filter((s) => s.pid !== started.pid), started]),
    remove: (pid) => save(load().filter((s) => s.pid !== pid)),
    sweep: () => {
      const killed = load()
        .filter((s) => sameCommand(read(s.pid), s.command))
        .map((s) => s.pid);
      killed.forEach(killGroup);
      save([]);
      return killed;
    }
  };
}
