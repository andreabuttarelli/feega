import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { withDevServer } from './folder-source';
import { reapLeftovers, spawnGroup, stopDevChildren } from './dev-children';

const GONE_MS = 10_000;
const POLL_MS = 100;
const TEST_MS = 60_000;

const PARENT = `import { spawn } from 'node:child_process';
spawn(process.execPath, ['child.mjs'], { stdio: 'inherit' });
setInterval(() => {}, 1000);
`;

const CHILD = `import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
writeFileSync('grandchild.pid', String(process.pid));
const port = Number(process.env.PORT ?? 0);
createServer((_req, res) => res.end('ok')).listen(port, '127.0.0.1');
`;

const STUBBORN = `${CHILD}process.on('SIGTERM', () => {});
`;

const roots: string[] = [];

async function devTree(child = CHILD): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'feega-dev-tree-'));
  roots.push(root);
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { dev: 'node parent.mjs' } }));
  await writeFile(join(root, 'parent.mjs'), PARENT);
  await writeFile(join(root, 'child.mjs'), child);
  return root;
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function gone(pid: number): Promise<boolean> {
  const until = Date.now() + GONE_MS;
  while (Date.now() < until) {
    if (!alive(pid)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

async function pidIn(root: string): Promise<number> {
  const until = Date.now() + GONE_MS;
  while (Date.now() < until) {
    const text = await readFile(join(root, 'grandchild.pid'), 'utf8').catch(() => '');
    if (text) {
      return Number(text);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('the fake dev server never started');
}

afterEach(async () => {
  stopDevChildren();
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe('the dev server a folder import starts', () => {
  it('is gone with every process it spawned once the import that used it ends', { timeout: TEST_MS }, async () => {
    const root = await devTree();

    const answered = await withDevServer(root, null, async (url) => (await fetch(url)).status);
    const grandchild = await pidIn(root);

    expect(answered).toBe(200);
    expect(await gone(grandchild)).toBe(true);
  });

  it('is gone even when it ignores SIGTERM, as a busy Vite does for minutes', { timeout: TEST_MS }, async () => {
    const root = await devTree(STUBBORN);

    await withDevServer(root, null, async (url) => (await fetch(url)).status);
    const grandchild = await pidIn(root);

    expect(await gone(grandchild)).toBe(true);
  });

  it('two imports of the same folder share one server, which stops after the last one', { timeout: TEST_MS }, async () => {
    const root = await devTree();
    let release = () => {};
    const held = new Promise<void>((r) => (release = r));

    const first = withDevServer(root, null, () => held);
    const grandchild = await pidIn(root);
    await withDevServer(root, null, async (url) => (await fetch(url)).status);

    expect(alive(grandchild)).toBe(true);
    release();
    await first;
    expect(await gone(grandchild)).toBe(true);
  });

  const SHUTDOWNS = [
    { owner: 'a server with no stop handler of its own', stop: '' },
    { owner: 'a server that closes itself on SIGTERM, as the desktop app and npm run local do', stop: "process.once('SIGTERM', () => clearInterval(timer));" }
  ];

  it.each(SHUTDOWNS)('dies with $owner when it is told to stop', { timeout: TEST_MS }, async ({ stop }) => {
    const root = await devTree();
    const module = fileURLToPath(new URL('./dev-children.ts', import.meta.url));
    const script = `import { spawnGroup } from ${JSON.stringify(module)};
spawnGroup('npm', ['run', 'dev'], { cwd: ${JSON.stringify(root)}, env: { ...process.env, PORT: '0' }, stdio: 'ignore' });
const timer = setInterval(() => {}, 1000);
${stop}
`;
    await writeFile(join(root, 'feega.mts'), script);
    const feega = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', join(root, 'feega.mts')], { stdio: 'ignore' });
    const grandchild = await pidIn(root);

    feega.kill('SIGTERM');
    await once(feega, 'exit');

    expect(await gone(grandchild)).toBe(true);
  });

  it('a leftover from a feega that was killed outright is reaped at the next start, and nothing else is', { timeout: TEST_MS }, async () => {
    const root = await devTree();
    const ours = spawnGroup('npm', ['run', 'dev'], { cwd: root, env: { ...process.env, PORT: '0' }, stdio: 'ignore' });
    const grandchild = await pidIn(root);
    const theirs = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });

    reapLeftovers({ ownerAlive: () => false });

    expect(await gone(grandchild)).toBe(true);
    expect(ours.pid).toBeDefined();
    expect(alive(theirs.pid!)).toBe(true);
    process.kill(theirs.pid!);
  });
});
