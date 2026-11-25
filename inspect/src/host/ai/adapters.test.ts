import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AcpId, adapterOf } from './acp-agents';
import { adapters, explain, NPM_MISSING, OFFLINE } from './adapters';

const NODE = { command: '/node', env: { ELECTRON_RUN_AS_NODE: '1' } };

function setup(fail?: Error) {
  const dir = mkdtempSync(join(tmpdir(), 'adapters-'));
  const calls: string[][] = [];
  const npm = async (args: string[]) => {
    calls.push(args);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (fail) {
      throw fail;
    }
    const prefix = args[args.indexOf('--prefix') + 1];
    const pkg = args.at(-1)!.replace(/@[^@/]+$/, '');
    const root = join(prefix, 'node_modules', pkg);
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ bin: { tool: 'dist/index.js' } }));
  };
  return { dir, calls, store: adapters({ dir, node: NODE, npm }) };
}

describe('the adapter store', () => {
  it('is not ready before the install and launches the installed entry with node afterwards', async () => {
    const t = setup();
    expect(t.store.ready(AcpId.Claude)).toBe(false);

    await t.store.install(AcpId.Claude);

    const spec = adapterOf(AcpId.Claude)!;
    expect(t.store.ready(AcpId.Claude)).toBe(true);
    expect(t.calls[0]).toContain(`${spec.pkg}@${spec.version}`);
    expect(t.store.launch(AcpId.Claude)).toEqual({
      command: '/node',
      args: [join(t.dir, `${spec.pkg.replace('/', '__')}@${spec.version}`, 'node_modules', spec.pkg, 'dist/index.js')],
      env: NODE.env
    });
  });

  it('installs once when asked twice at the same time', async () => {
    const t = setup();

    await Promise.all([t.store.install(AcpId.Pi), t.store.install(AcpId.Pi)]);

    expect(t.calls).toHaveLength(1);
  });

  it('removes a version that is no longer pinned', async () => {
    const t = setup();
    mkdirSync(join(t.dir, 'pi-acp@0.0.1', 'node_modules'), { recursive: true });
    mkdirSync(join(t.dir, 'gone-pkg@1.0.0'), { recursive: true });

    await t.store.install(AcpId.Pi);

    expect(readdirSync(t.dir)).toEqual([`pi-acp@${adapterOf(AcpId.Pi)!.version}`]);
  });

  it('is not ready and can retry after a failed install', async () => {
    const t = setup(new Error('boom'));

    await expect(t.store.install(AcpId.Codex)).rejects.toThrow('boom');
    await expect(t.store.install(AcpId.Codex)).rejects.toThrow('boom');

    expect(t.store.ready(AcpId.Codex)).toBe(false);
    expect(t.calls).toHaveLength(2);
    expect(existsSync(t.dir)).toBe(true);
  });
});

describe('what an install failure tells the user', () => {
  it('says npm is missing when it cannot be started', () => {
    expect(explain('ENOENT', '')).toBe(NPM_MISSING);
  });

  it('says the network is unreachable when npm could not fetch', () => {
    expect(explain(1, 'npm error code ENOTFOUND\nnpm error network request failed')).toBe(OFFLINE);
    expect(explain(1, 'npm error code EAI_AGAIN')).toBe(OFFLINE);
  });

  it('keeps the last line of npm otherwise', () => {
    expect(explain(1, 'npm error first\nnpm error E404 not found')).toBe('npm error E404 not found');
  });
});
