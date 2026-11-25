import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyLauncher } from './launcher-copy';

const FILES = 40;
const ROUNDS = 25;
const COPIERS = 4;

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'launcher-copy-'));
  await mkdir(join(dir, 'source', 'nested'), { recursive: true });
  for (let i = 0; i < FILES; i++) {
    await writeFile(join(dir, 'source', i % 2 ? 'nested' : '.', `f${i}.js`), `file ${i}`);
  }
});

afterEach(() => rm(dir, { recursive: true, force: true }));

describe('copyLauncher', () => {
  it('due editor sulla stessa cartella copiano il launcher insieme senza errori', async () => {
    const target = join(dir, 'target');

    for (let round = 0; round < ROUNDS; round++) {
      await Promise.all(Array.from({ length: COPIERS }, () => copyLauncher(join(dir, 'source'), target)));
    }

    expect(await readFile(join(target, 'f0.js'), 'utf8')).toBe('file 0');
    expect(await readFile(join(target, 'nested', 'f1.js'), 'utf8')).toBe('file 1');
    expect((await readdir(target)).some((name) => name.endsWith('.tmp'))).toBe(false);
  });
});
