import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { type PidFile } from './pid-file';

const EDITOR_READY = /editor ready on (https?:\/\/\S+)/;
const STOP_ON_STDIN_END = 'FEEGA_STOP_ON_STDIN_END';
const GRACE_MS = 4000;
const TAIL_LINES = 4;

export type CliEvents = {
  onUrl: (url: string) => void;
  onLine: (line: string) => void;
  onExit: (tail: string) => void;
};

export const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });

export async function startCli(dir: string, pids: PidFile, events: CliEvents) {
  const port = await freePort();
  const cli = join(__dirname, '..', '..', 'npx', 'dist', 'cli.cjs');
  const args = [cli, dir, '--no-open', '--port', String(port)];
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', [STOP_ON_STDIN_END]: '1', FORCE_COLOR: '0' }
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
    if (child.pid) {
      pids.remove(child.pid);
    }
    events.onExit(lines.slice(-TAIL_LINES).join('\n'));
  });

  const signalGroup = (signal: NodeJS.Signals) => {
    if (!child.pid) {
      return;
    }
    try {
      process.kill(-child.pid, signal);
    } catch {
      return;
    }
  };

  return {
    stop: () =>
      new Promise<void>((resolve) => {
        if (exited) {
          resolve();
          return;
        }
        const timer = setTimeout(() => signalGroup('SIGKILL'), GRACE_MS);
        child.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
        signalGroup('SIGTERM');
      })
  };
}
