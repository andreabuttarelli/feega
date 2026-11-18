import { describe, expect, it } from 'vitest';
import { DevSource, devServer } from './dev-server';
import { DevState, type DevStatus } from './supervisor';

const repo = { packageJson: JSON.stringify({ scripts: { dev: 'next dev' } }), lockfiles: [] };

function supervisor(initial: DevState = DevState.Stopped) {
  const calls: string[] = [];
  let state = initial;
  return {
    calls,
    start: (command: { bin: string }) => {
      calls.push(`start ${command.bin}`);
      state = DevState.Starting;
    },
    stop: () => {
      calls.push('stop');
      state = DevState.Stopped;
    },
    status: (): DevStatus => ({ state, url: null, logs: [] })
  };
}

describe('devServer', () => {
  it('trova un dev server già acceso e non ne avvia un altro', async () => {
    const sup = supervisor();
    const dev = devServer({ folder: '/app', repo: () => repo, running: async () => 'http://localhost:3000', supervisor: sup });
    expect(await dev.start()).toMatchObject({ state: DevState.Running, url: 'http://localhost:3000', source: DevSource.Detected });
    expect(sup.calls).toEqual([]);
  });

  it('avvia il comando rilevato quando nessuno risponde', async () => {
    const sup = supervisor();
    const dev = devServer({ folder: '/app', repo: () => repo, running: async () => null, supervisor: sup });
    expect(await dev.start()).toMatchObject({ state: DevState.Starting, source: DevSource.Spawned });
    expect(sup.calls).toEqual(['start npm']);
  });

  it('senza script dev rifiuta con un motivo', async () => {
    const dev = devServer({ folder: '/app', repo: () => ({ packageJson: '{}', lockfiles: [] }), running: async () => null, supervisor: supervisor() });
    await expect(dev.start()).rejects.toThrow(/dev script/);
  });

  it('lo stato riporta ciò che il supervisore sta facendo', async () => {
    const sup = supervisor(DevState.Crashed);
    const dev = devServer({ folder: '/app', repo: () => repo, running: async () => null, supervisor: sup });
    expect(await dev.status()).toMatchObject({ state: DevState.Crashed, folder: '/app' });
  });
});
