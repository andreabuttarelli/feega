import { spawn, type ChildProcess } from 'node:child_process';

const READY = /editor ready on (http:\/\/\S+)/;
const START_TIMEOUT_MS = 120_000;
const STOP_ON_STDIN_END = 'FEEGA_STOP_ON_STDIN_END';

export type Editors = {
  ensure: (dir: string) => Promise<{ url: string }>;
  release: (dir: string) => Promise<void>;
};

export const editorUrlOf = (line: string): string | null => line.match(READY)?.[1] ?? null;

export type Spawn = (command: string, args: string[], env: NodeJS.ProcessEnv) => ChildProcess;

const spawnPiped: Spawn = (command, args, env) => spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'], env });

export function childEditors(cli: string, spawnChild: Spawn = spawnPiped, timeoutMs = START_TIMEOUT_MS): Editors {
  const running = new Map<string, Promise<{ url: string; child: ChildProcess }>>();

  const launch = (dir: string) =>
    new Promise<{ url: string; child: ChildProcess }>((resolve, reject) => {
      const child = spawnChild(process.execPath, [cli, dir, '--no-open'], { ...process.env, [STOP_ON_STDIN_END]: '1' });
      const timer = setTimeout(() => reject(new Error(`the editor for ${dir} did not start`)), timeoutMs);
      let seen = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        seen += String(chunk);
        const url = editorUrlOf(seen);
        if (url) {
          clearTimeout(timer);
          resolve({ url, child });
        }
      });
      child.once('exit', () => {
        clearTimeout(timer);
        running.delete(dir);
        reject(new Error(`the editor for ${dir} stopped: ${seen.trim().split('\n').pop() ?? ''}`));
      });
    });

  return {
    ensure: async (dir) => {
      const held = running.get(dir) ?? launch(dir);
      running.set(dir, held);
      const { url } = await held.catch((error: Error) => {
        running.delete(dir);
        throw error;
      });
      return { url };
    },
    release: async (dir) => {
      const held = running.get(dir);
      running.delete(dir);
      (await held?.catch(() => undefined))?.child.kill();
    }
  };
}
