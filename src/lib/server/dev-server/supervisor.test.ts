import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { DevState, superviseDev, type Child } from './supervisor';

type Fake = Child & { killed: boolean; out: (line: string) => void; exit: (code: number) => void };

function fakeChild(): Fake {
  const emitter = new EventEmitter();
  const stdout = new EventEmitter();
  const child: Fake = {
    killed: false,
    stdout,
    stderr: new EventEmitter(),
    on: (event: string, fn: (code: number | null) => void) => {
      emitter.on(event, fn);
    },
    kill() {
      child.killed = true;
      emitter.emit('exit', null);
    },
    out: (line: string) => stdout.emit('data', Buffer.from(line)),
    exit: (code: number) => emitter.emit('exit', code)
  };
  return child;
}

const cmd = { bin: 'npm', args: ['run', 'dev'] };

describe('superviseDev', () => {
  it('legge l indirizzo dai log e passa a running', () => {
    const child = fakeChild();
    const dev = superviseDev({ spawn: () => child, maxRestarts: 1 });
    dev.start(cmd, '/app');
    child.out('  - Local:        http://localhost:3000\n');
    expect(dev.status()).toMatchObject({ state: DevState.Running, url: 'http://localhost:3000' });
    expect(dev.status().logs.join('')).toContain('Local');
  });

  it('riparte quando muore da solo, fino al limite', () => {
    const children = [fakeChild(), fakeChild(), fakeChild()];
    let spawned = 0;
    const dev = superviseDev({ spawn: () => children[spawned++], maxRestarts: 1 });
    dev.start(cmd, '/app');
    children[0].exit(1);
    expect(spawned).toBe(2);
    children[1].exit(1);
    expect(spawned).toBe(2);
    expect(dev.status().state).toBe(DevState.Crashed);
  });

  it('stop uccide il processo e non riparte', () => {
    const child = fakeChild();
    let spawned = 0;
    const dev = superviseDev({
      spawn: () => {
        spawned++;
        return child;
      },
      maxRestarts: 3
    });
    dev.start(cmd, '/app');
    dev.stop();
    expect(child.killed).toBe(true);
    expect(spawned).toBe(1);
    expect(dev.status().state).toBe(DevState.Stopped);
  });
});
