import { app } from 'electron';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { killTree } from '../../../inspect/src/host/process-tree';
import { cliEnv, type EnvOptions } from './cli-env';
import { type PidFile } from './pid-file';
import { GracefulStop, platformRow } from './platform';

const EDITOR_READY = /editor ready on (https?:\/\/\S+)/;
const GRACE_MS = 4000;
const TAIL_LINES = 4;

export type CliEvents = {
  onUrl: (url: string) => void;
  onLine: (line: string) => void;
  onExit: (tail: string) => void;
};

const MAX_PORT = 65535;
const AUTO = 0;

const reserved = new Set<number>();

const portFree = (port: number) =>
  new Promise<number | null>((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => {
      const { port: bound } = server.address() as { port: number };
      server.close(() => resolve(bound));
    });
  });

export async function freePort(from: number = AUTO): Promise<number> {
  for (let port = from; port <= (from === AUTO ? AUTO : MAX_PORT); port++) {
    const bound = reserved.has(port) ? null : await portFree(port);
    if (bound !== null && !reserved.has(bound)) {
      reserved.add(bound);
      return bound;
    }
  }
  return freePort(AUTO);
}

export const bundledDir = () => (app.isPackaged ? join(process.resourcesPath, 'npx') : join(__dirname, '..', '..', 'npx', 'dist'));

const bundledCli = () => join(bundledDir(), 'cli.cjs');

export type CliOptions = EnvOptions;

export async function startCli(dir: string, pids: PidFile, options: CliOptions, events: CliEvents) {
  const port = await freePort(options.editorPort);
  const cli = bundledCli();
  const args = [cli, dir, '--no-open', '--port', String(port)];
  const row = platformRow(process.platform);
  const child = spawn(process.execPath, args, {
    detached: row.detached,
    windowsHide: row.windowsHide,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: cliEnv(process.env, options, app.getPath('userData'))
  });

  if (child.pid) {
    pids.add({ pid: child.pid, command: [process.execPath, ...args].join(' ') });
  }

  const lines: string[] = [];
  let exited = false;
  let buffer = '';

  const take = (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const line of parts.map((l) => l.trim()).filter(Boolean)) {
      lines.push(line);
      events.onLine(line);
      const url = EDITOR_READY.exec(line)?.[1];
      if (url) {
        events.onUrl(url);
      }
    }
  };

  child.stdout.on('data', take);
  child.stderr.on('data', take);
  child.on('exit', () => {
    exited = true;
    reserved.delete(port);
    if (child.pid) {
      pids.remove(child.pid);
    }
    events.onExit(lines.slice(-TAIL_LINES).join('\n'));
  });

  const stopGracefully = () => {
    if (row.graceful === GracefulStop.Stdin) {
      child.stdin.end();
      return;
    }
    if (child.pid) {
      killTree(child.pid, 'SIGTERM');
    }
  };

  return {
    stop: () =>
      new Promise<void>((resolve) => {
        if (exited) {
          resolve();
          return;
        }
        const timer = setTimeout(() => child.pid && killTree(child.pid, 'SIGKILL'), GRACE_MS);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        stopGracefully();
      })
  };
}
