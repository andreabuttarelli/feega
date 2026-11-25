import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADAPTED, adapterOf, type AcpId } from './acp-agents';
import type { Launch } from './agent-session';

export const NPM_MISSING = 'npm was not found. Install Node.js from nodejs.org, then retry.';
export const OFFLINE = 'Could not reach npm. Check your connection, then retry.';

const READY_MARKER = '.feega-ready';
const NETWORK_CODES = ['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'network'];
const NPM_FLAGS = ['--no-audit', '--no-fund', '--no-progress', '--loglevel=error'];

export type Adapters = {
  ready: (id: AcpId) => boolean;
  install: (id: AcpId) => Promise<void>;
  launch: (id: AcpId) => Launch;
};

export type NodeRuntime = { command: string; env: Record<string, string> };

export type AdapterDeps = { dir: string; node: NodeRuntime; npm: (args: string[]) => Promise<void> };

export const explain = (code: number | string | null, stderr: string): string => {
  if (code === 'ENOENT') {
    return NPM_MISSING;
  }
  if (NETWORK_CODES.some((word) => stderr.includes(word))) {
    return OFFLINE;
  }
  const lines = stderr.split('\n').filter((line) => line.trim());
  return lines.at(-1)?.trim() ?? `npm exited with ${code}`;
};

export const runNpm = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn('npm', args, { stdio: ['ignore', 'ignore', 'pipe'], shell: process.platform === 'win32' });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += String(chunk)));
    child.on('error', (error: NodeJS.ErrnoException) => reject(new Error(explain(error.code ?? null, ''))));
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(explain(code, stderr)))));
  });

export const adapters = ({ dir, node, npm }: AdapterDeps): Adapters => {
  const installing = new Map<AcpId, Promise<void>>();

  const spec = (id: AcpId) => {
    const found = adapterOf(id);
    if (!found) {
      throw new Error(`${id} has no adapter`);
    }
    return found;
  };

  const folderOf = (id: AcpId): string => `${spec(id).pkg.replace('/', '__')}@${spec(id).version}`;

  const prefixOf = (id: AcpId): string => join(dir, folderOf(id));

  const ready = (id: AcpId): boolean => existsSync(join(prefixOf(id), READY_MARKER));

  const prune = () => {
    const pinned = new Set(ADAPTED.map(folderOf));
    readdirSync(dir)
      .filter((name) => !pinned.has(name))
      .forEach((name) => rmSync(join(dir, name), { recursive: true, force: true }));
  };

  const run = async (id: AcpId) => {
    mkdirSync(dir, { recursive: true });
    prune();
    rmSync(prefixOf(id), { recursive: true, force: true });
    await npm(['install', '--prefix', prefixOf(id), ...NPM_FLAGS, `${spec(id).pkg}@${spec(id).version}`]);
    writeFileSync(join(prefixOf(id), READY_MARKER), '');
  };

  const install = (id: AcpId): Promise<void> => {
    const running = installing.get(id) ?? run(id).finally(() => installing.delete(id));
    installing.set(id, running);
    return running;
  };

  const launch = (id: AcpId): Launch => {
    const root = join(prefixOf(id), 'node_modules', spec(id).pkg);
    const { bin } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { bin: string | Record<string, string> };
    const entry = typeof bin === 'string' ? bin : Object.values(bin)[0];
    return { command: node.command, args: [join(root, entry)], env: node.env };
  };

  return { ready, install, launch };
};
