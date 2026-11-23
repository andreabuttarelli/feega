import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WATCHED, fsWatch, pollWatch, type Watch } from './file-watch';

const WAIT_MS = 4000;
const WRITE_DELAY_MS = 200;

const empty = () => mkdtempSync(join(tmpdir(), 'feega-watch-'));

const changedAfter = (watch: Watch, root: string, write: () => void) =>
  new Promise<boolean>((resolve) => {
    const handle = watch(root, () => resolve(true));
    setTimeout(write, WRITE_DELAY_MS);
    setTimeout(() => {
      handle.dispose();
      resolve(false);
    }, WAIT_MS);
  });

describe('WATCHED', () => {
  it.each([
    ['src/App.tsx', true],
    ['src/lib/Button.svelte', true],
    ['tsconfig.json', true],
    ['package.json', true],
    ['node_modules/react/index.js', false],
    ['.git/index', false],
    ['dist/app.js', false],
    ['README.md', false]
  ])('%s -> %s', (path, watched) => {
    expect(WATCHED(path)).toBe(watched);
  });
});

describe('fsWatch', () => {
  it('avvisa quando un file sorgente nasce in una cartella nuova', async () => {
    const root = empty();

    expect(
      await changedAfter(fsWatch, root, () => {
        mkdirSync(join(root, 'src'));
        writeFileSync(join(root, 'src/A.tsx'), 'export const a = 1;\n');
      })
    ).toBe(true);
  });

  it('non avvisa per un file dentro node_modules', async () => {
    const root = empty();
    mkdirSync(join(root, 'node_modules'));

    expect(await changedAfter(fsWatch, root, () => writeFileSync(join(root, 'node_modules/x.js'), '1'))).toBe(false);
  });
});

describe('pollWatch', () => {
  it('avvisa quando nasce un file sorgente', async () => {
    const root = empty();
    writeFileSync(join(root, 'A.tsx'), '1');

    expect(await changedAfter(pollWatch, root, () => writeFileSync(join(root, 'B.tsx'), '2'))).toBe(true);
  });
});
