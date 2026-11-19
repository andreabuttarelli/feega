import { execFile } from 'node:child_process';

export type RunCommand = (command: string, args: string[]) => unknown;

export type TreeHost = { platform: NodeJS.Platform; run: RunCommand; signal: (pid: number, signal: NodeJS.Signals) => void };

const SYSTEM: TreeHost = {
  platform: process.platform,
  run: (command, args) => execFile(command, args, () => undefined),
  signal: (pid, signal) => process.kill(pid, signal)
};

export const killTree = (pid: number, signal: NodeJS.Signals, host: TreeHost = SYSTEM) => {
  if (host.platform === 'win32') {
    host.run('taskkill', ['/pid', String(pid), '/T', '/F']);
    return;
  }
  try {
    host.signal(-pid, signal);
  } catch {
    return;
  }
};

export const commandLineOf = (pid: number, platform: NodeJS.Platform = process.platform): [string, string[]] =>
  platform === 'win32'
    ? ['powershell', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`]]
    : ['ps', ['-o', 'command=', '-p', String(pid)]];
