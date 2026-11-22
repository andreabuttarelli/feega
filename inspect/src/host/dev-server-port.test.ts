import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { freePort, listening, watchOutput } from './dev-server';
import { until } from './ready';

const STARTUP_MS = 10_000;
const SERVER_DELAY_MS = 300;
const open: Server[] = [];

const hold = (port: number) =>
  new Promise<void>((resolve) => {
    const server = createServer().listen(port, '127.0.0.1', resolve);
    open.push(server);
  });

afterEach(() => open.splice(0).forEach((s) => s.close()));

describe('a dev server that cannot take the planned port', () => {
  it('opens the preview on the port it printed, not on the stranger holding the planned one', async () => {
    const planned = await freePort();
    const actual = await freePort();
    await hold(planned);
    const script = `setTimeout(() => require('net').createServer().listen(${actual}, '127.0.0.1', () => console.log('  Local:   http://127.0.0.1:${actual}/')), ${SERVER_DELAY_MS}); setInterval(() => {}, 1000)`;
    const child = spawn('node', ['-e', script]);
    const seen = watchOutput(child);

    const ready = await until(planned, child, seen, {
      listening,
      ours: async () => false,
      wait: () => new Promise((r) => setTimeout(r, 50)),
      now: Date.now,
      timeoutMs: STARTUP_MS
    });
    child.kill();

    expect(ready).toBe(`http://127.0.0.1:${actual}/`);
  });
});
