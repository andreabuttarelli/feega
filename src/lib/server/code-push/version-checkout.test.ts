import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from './git-cli';
import { checkoutAt } from './version-checkout';

const made: string[] = [];

afterAll(async () => {
  await Promise.all(made.map((d) => rm(d, { recursive: true, force: true })));
});

const must = async (dir: string, args: string[]) => {
  const done = await git(dir, args);
  if (done.code) {
    throw new Error(done.err);
  }
  return done.out.trim();
};

async function repo() {
  const dir = await mkdtemp(join(tmpdir(), 'feega-vc-'));
  made.push(dir);
  await must(dir, ['init', '-q', '-b', 'main']);
  await must(dir, ['config', 'user.email', 't@t']);
  await must(dir, ['config', 'user.name', 'T']);
  await writeFile(join(dir, 'page.tsx'), 'one');
  await must(dir, ['add', '.']);
  await must(dir, ['commit', '-qm', 'one']);
  const first = await must(dir, ['rev-parse', 'HEAD']);
  await writeFile(join(dir, 'page.tsx'), 'two');
  await must(dir, ['commit', '-qam', 'two']);
  await mkdir(join(dir, 'node_modules'));
  await writeFile(join(dir, 'page.tsx'), 'work in progress');
  return { dir, first };
}

describe('una copia del codice a uno sha', () => {
  it('ha i file di quello sha, riusa le dipendenze e non tocca la copia di lavoro', async () => {
    const { dir, first } = await repo();

    const at = await checkoutAt(dir, first);
    made.push(at);

    expect(await readFile(join(at, 'page.tsx'), 'utf8')).toBe('one');
    expect((await lstat(join(at, 'node_modules'))).isSymbolicLink()).toBe(true);
    expect(await readFile(join(dir, 'page.tsx'), 'utf8')).toBe('work in progress');
    expect(await must(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('main');
    expect(await checkoutAt(dir, first)).toBe(at);
  });
});
