import type { Command } from './dev-command';

export enum DevState {
  Stopped = 'stopped',
  Starting = 'starting',
  Running = 'running',
  Crashed = 'crashed'
}

type Stream = { on: (event: 'data', fn: (chunk: Buffer) => void) => unknown };

export type Child = {
  stdout: Stream | null;
  stderr: Stream | null;
  on: (event: 'exit', fn: (code: number | null) => void) => unknown;
  kill: () => unknown;
};

export type DevStatus = { state: DevState; url: string | null; logs: string[] };

type Deps = { spawn: (command: Command, cwd: string) => Child; maxRestarts: number; logLines?: number };

const LOG_LINES = 200;
const LOCAL_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+/;
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

export function superviseDev(deps: Deps) {
  let state = DevState.Stopped;
  let url: string | null = null;
  let child: Child | null = null;
  let restarts = 0;
  const logs: string[] = [];

  const log = (chunk: Buffer) => {
    const text = chunk.toString().replace(ANSI, '');
    logs.push(text);
    logs.splice(0, Math.max(0, logs.length - (deps.logLines ?? LOG_LINES)));
    const found = url ? null : text.match(LOCAL_URL);
    if (found) {
      url = found[0];
      state = DevState.Running;
    }
  };

  const run = (command: Command, cwd: string) => {
    const started = deps.spawn(command, cwd);
    child = started;
    started.stdout?.on('data', log);
    started.stderr?.on('data', log);
    started.on('exit', () => {
      if (child !== started) {
        return;
      }
      child = null;
      url = null;
      if (restarts >= deps.maxRestarts) {
        state = DevState.Crashed;
        return;
      }
      restarts++;
      state = DevState.Starting;
      run(command, cwd);
    });
  };

  return {
    start(command: Command, cwd: string) {
      if (child) {
        return;
      }
      restarts = 0;
      state = DevState.Starting;
      run(command, cwd);
    },
    stop() {
      const running = child;
      child = null;
      url = null;
      state = DevState.Stopped;
      running?.kill();
    },
    status: (): DevStatus => ({ state, url, logs: [...logs] })
  };
}
