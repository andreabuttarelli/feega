import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const sdk = vi.hoisted(() => ({
  getOrCreate: vi.fn(),
  fork: vi.fn(),
  get: vi.fn(),
  list: vi.fn()
}));

vi.mock('@vercel/sandbox', () => ({ Sandbox: { getOrCreate: sdk.getOrCreate, fork: sdk.fork, get: sdk.get, list: sdk.list } }));

import { FARM_BASE, farmAccess, vercelFarm, workerPrefix } from './vercel-farm';

function fakeSandbox(status = 'stopped') {
  return {
    status,
    name: 'box-1',
    stop: vi.fn(async () => {}),
    writeFiles: vi.fn(async () => {}),
    readFileToBuffer: vi.fn(async () => Buffer.from('bytes')),
    runCommand: vi.fn(async () => ({ exitCode: 0, stdout: async () => 'out\n', stderr: async () => 'err\n' }))
  };
}

const TOKEN = { VERCEL_TOKEN: 't', VERCEL_TEAM_ID: 'team', VERCEL_PROJECT_ID: 'prj' };

describe('farmAccess', () => {
  it('an explicit token with team and project wins', () => {
    expect(farmAccess(TOKEN)).toEqual({ token: 't', teamId: 'team', projectId: 'prj' });
  });

  it('the sandbox-only token works the same way', () => {
    expect(farmAccess({ SANDBOX_VERCEL_TOKEN: 's', VERCEL_TEAM_ID: 'team', VERCEL_PROJECT_ID: 'prj' })).toEqual({ token: 's', teamId: 'team', projectId: 'prj' });
  });

  it('on Vercel without a token it uses the deployment OIDC identity', () => {
    expect(farmAccess({ VERCEL: '1' })).toEqual({});
  });

  it('a token without its team is not access, and off Vercel nothing is', () => {
    expect(farmAccess({ VERCEL_TOKEN: 't' })).toBeNull();
    expect(farmAccess({})).toBeNull();
  });
});

describe('vercelFarm', () => {
  beforeEach(() => {
    sdk.getOrCreate.mockReset();
    sdk.fork.mockReset();
    sdk.get.mockReset();
  });

  it('a worker starts a command detached, so it keeps running after the request returns', async () => {
    const box = fakeSandbox('running');
    sdk.getOrCreate.mockResolvedValue(fakeSandbox());
    sdk.fork.mockResolvedValue(box);
    const worker = await vercelFarm({}).open({ allowHosts: [], timeoutMs: 1, vcpus: 4 });

    await worker.spawn('bash', ['-c', 'node steps.mjs']);

    expect(worker.name).toBe('box-1');
    expect(box.runCommand).toHaveBeenCalledWith({ cmd: 'bash', args: ['-c', 'node steps.mjs'], detached: true });
  });

  it('attaches to a running worker by name, without preparing the base', async () => {
    sdk.get.mockResolvedValue(fakeSandbox('running'));

    const worker = await vercelFarm({ token: 't' }).attach('box-1');

    expect(sdk.get).toHaveBeenCalledWith(expect.objectContaining({ name: 'box-1', token: 't' }));
    expect(worker?.name).toBe('box-1');
    expect(sdk.getOrCreate).not.toHaveBeenCalled();
  });

  it('a stopped or unknown worker attaches to nothing', async () => {
    sdk.get.mockResolvedValueOnce(fakeSandbox('stopped')).mockRejectedValueOnce(new Error('not found'));
    const farm = vercelFarm({});

    expect(await farm.attach('box-1')).toBeNull();
    expect(await farm.attach('box-2')).toBeNull();
  });

  it('forks the prepared base with only the allowed hosts reachable and no app env', async () => {
    sdk.getOrCreate.mockResolvedValue(fakeSandbox());
    sdk.fork.mockResolvedValue(fakeSandbox('running'));

    await vercelFarm({ token: 't', teamId: 'team', projectId: 'prj' }).open({ allowHosts: ['x.supabase.co'], timeoutMs: 60_000, vcpus: 8 });

    expect(sdk.getOrCreate).toHaveBeenCalledWith(expect.objectContaining({ name: FARM_BASE, persistent: true, token: 't' }));
    const forked = sdk.fork.mock.calls[0][0];
    expect(forked).toMatchObject({ sourceSandbox: FARM_BASE, networkPolicy: { allow: ['x.supabase.co'] }, timeout: 60_000, resources: { vcpus: 8 }, persistent: false, env: {} });
  });

  it('a base still running after its setup is stopped, so forks start from its snapshot', async () => {
    const base = fakeSandbox('running');
    sdk.getOrCreate.mockResolvedValue(base);
    sdk.fork.mockResolvedValue(fakeSandbox('running'));

    await vercelFarm({}).open({ allowHosts: [], timeoutMs: 1, vcpus: 4 });

    expect(base.stop).toHaveBeenCalled();
  });

  it('prepares the base once for many workers', async () => {
    sdk.getOrCreate.mockResolvedValue(fakeSandbox());
    sdk.fork.mockResolvedValue(fakeSandbox('running'));
    const farm = vercelFarm({});

    await Promise.all([farm.open({ allowHosts: [], timeoutMs: 1, vcpus: 4 }), farm.open({ allowHosts: [], timeoutMs: 1, vcpus: 4 })]);

    expect(sdk.getOrCreate).toHaveBeenCalledTimes(1);
    expect(sdk.fork).toHaveBeenCalledTimes(2);
  });

  it('a worker runs commands, writes and reads files and stops through the sandbox', async () => {
    const box = fakeSandbox('running');
    sdk.getOrCreate.mockResolvedValue(fakeSandbox());
    sdk.fork.mockResolvedValue(box);
    const worker = await vercelFarm({}).open({ allowHosts: [], timeoutMs: 1, vcpus: 4 });

    expect(await worker.run('ffmpeg', ['-v'])).toEqual({ exitCode: 0, output: 'out\nerr\n' });
    await worker.write([{ path: '/a', content: Buffer.from('x') }]);
    expect((await worker.read('/b'))?.toString()).toBe('bytes');
    await worker.stop();

    expect(box.runCommand).toHaveBeenCalledWith('ffmpeg', ['-v']);
    expect(box.writeFiles).toHaveBeenCalledWith([{ path: '/a', content: Buffer.from('x') }]);
    expect(box.stop).toHaveBeenCalled();
  });

  it('a base that failed to prepare is retried on the next render', async () => {
    sdk.getOrCreate.mockRejectedValueOnce(new Error('quota')).mockResolvedValue(fakeSandbox());
    sdk.fork.mockResolvedValue(fakeSandbox('running'));
    const farm = vercelFarm({});

    await expect(farm.open({ allowHosts: [], timeoutMs: 1, vcpus: 4 })).rejects.toThrow('quota');
    await farm.open({ allowHosts: [], timeoutMs: 1, vcpus: 4 });

    expect(sdk.getOrCreate).toHaveBeenCalledTimes(2);
  });
});

describe('the farm knows its own workers', () => {
  beforeEach(() => {
    sdk.getOrCreate.mockReset();
    sdk.fork.mockReset();
    sdk.list.mockReset();
  });

  it('a worker is named after the farm and its deployment, so a reaper finds only its own', async () => {
    sdk.getOrCreate.mockResolvedValue(fakeSandbox());
    sdk.fork.mockResolvedValue(fakeSandbox('running'));

    await vercelFarm({}, 'production').open({ allowHosts: [], timeoutMs: 1, vcpus: 4 });

    expect(sdk.fork).toHaveBeenCalledWith(expect.objectContaining({ name: expect.stringMatching(new RegExp(`^${workerPrefix('production')}`)) }));
    expect(workerPrefix('production')).not.toBe(workerPrefix('preview'));
  });

  it('lists only its running workers, with when they started', async () => {
    sdk.list.mockResolvedValue({
      toArray: async () => [
        { name: `${workerPrefix('production')}a`, status: 'running', createdAt: 5 },
        { name: `${workerPrefix('production')}b`, status: 'stopped', createdAt: 6 }
      ]
    });

    const running = await vercelFarm({ token: 't' }, 'production').running();

    expect(sdk.list).toHaveBeenCalledWith(expect.objectContaining({ namePrefix: workerPrefix('production'), sortBy: 'name', token: 't' }));
    expect(running).toEqual([{ name: `${workerPrefix('production')}a`, createdAt: 5 }]);
  });
});

describe('what a worker cost', () => {
  it('reads CPU, memory and the time from start to stop, after the worker stopped', async () => {
    sdk.get.mockResolvedValue({ ...fakeSandbox('stopped'), activeCpuUsageMs: 35_000, memory: 8192, createdAt: new Date(1_000), statusUpdatedAt: new Date(17_000) });

    expect(await vercelFarm({}).usage('box-1')).toEqual({ cpuMs: 35_000, memoryMb: 8192, wallMs: 16_000 });
  });

  it('an unknown worker cost nothing we can read', async () => {
    sdk.get.mockRejectedValue(new Error('not found'));

    expect(await vercelFarm({}).usage('gone')).toBeNull();
  });
});

