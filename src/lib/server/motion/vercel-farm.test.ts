import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const sdk = vi.hoisted(() => ({
  getOrCreate: vi.fn(),
  fork: vi.fn()
}));

vi.mock('@vercel/sandbox', () => ({ Sandbox: { getOrCreate: sdk.getOrCreate, fork: sdk.fork } }));

import { FARM_BASE, farmAccess, vercelFarm } from './vercel-farm';

function fakeSandbox(status = 'stopped') {
  return {
    status,
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
  });

  it('forks the prepared base with only the allowed hosts reachable and no app env', async () => {
    sdk.getOrCreate.mockResolvedValue(fakeSandbox());
    sdk.fork.mockResolvedValue(fakeSandbox('running'));

    await vercelFarm({ token: 't', teamId: 'team', projectId: 'prj' }).open({ allowHosts: ['x.supabase.co'], timeoutMs: 60_000 });

    expect(sdk.getOrCreate).toHaveBeenCalledWith(expect.objectContaining({ name: FARM_BASE, persistent: true, token: 't' }));
    const forked = sdk.fork.mock.calls[0][0];
    expect(forked).toMatchObject({ sourceSandbox: FARM_BASE, networkPolicy: { allow: ['x.supabase.co'] }, timeout: 60_000, persistent: false, env: {} });
  });

  it('a base still running after its setup is stopped, so forks start from its snapshot', async () => {
    const base = fakeSandbox('running');
    sdk.getOrCreate.mockResolvedValue(base);
    sdk.fork.mockResolvedValue(fakeSandbox('running'));

    await vercelFarm({}).open({ allowHosts: [], timeoutMs: 1 });

    expect(base.stop).toHaveBeenCalled();
  });

  it('prepares the base once for many workers', async () => {
    sdk.getOrCreate.mockResolvedValue(fakeSandbox());
    sdk.fork.mockResolvedValue(fakeSandbox('running'));
    const farm = vercelFarm({});

    await Promise.all([farm.open({ allowHosts: [], timeoutMs: 1 }), farm.open({ allowHosts: [], timeoutMs: 1 })]);

    expect(sdk.getOrCreate).toHaveBeenCalledTimes(1);
    expect(sdk.fork).toHaveBeenCalledTimes(2);
  });

  it('a worker runs commands, writes and reads files and stops through the sandbox', async () => {
    const box = fakeSandbox('running');
    sdk.getOrCreate.mockResolvedValue(fakeSandbox());
    sdk.fork.mockResolvedValue(box);
    const worker = await vercelFarm({}).open({ allowHosts: [], timeoutMs: 1 });

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

    await expect(farm.open({ allowHosts: [], timeoutMs: 1 })).rejects.toThrow('quota');
    await farm.open({ allowHosts: [], timeoutMs: 1 });

    expect(sdk.getOrCreate).toHaveBeenCalledTimes(2);
  });
});
