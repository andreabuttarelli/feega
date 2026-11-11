import { describe, expect, it } from 'vitest';
import { gunzipSync, strToU8 } from 'fflate';
import { ignoredBy, keptDir, rulesOf, snapshotOf, SnapshotRefusal, SNAPSHOT_LIMITS, type PickedFile } from './snapshot';
import { untarred } from './tar';

const file = (path: string, text: string): PickedFile => ({ path, size: strToU8(text).length, bytes: async () => strToU8(text) });
const sized = (path: string, size: number): PickedFile => ({ path, size, bytes: async () => new Uint8Array(size) });

describe('gitignore rules', () => {
  const rules = rulesOf('', '# deps\n*.log\n/secret.env\ncache/\n!keep.log\nsrc/**/gen\n');

  it('a bare pattern matches at any depth', () => {
    expect(ignoredBy(rules, 'a/b/debug.log', false)).toBe(true);
  });

  it('a negation keeps a file back', () => {
    expect(ignoredBy(rules, 'keep.log', false)).toBe(false);
  });

  it('a leading slash anchors to the folder root', () => {
    expect(ignoredBy(rules, 'secret.env', false)).toBe(true);
    expect(ignoredBy(rules, 'nested/secret.env', false)).toBe(false);
  });

  it('a trailing slash matches only directories', () => {
    expect(ignoredBy(rules, 'cache', true)).toBe(true);
    expect(ignoredBy(rules, 'cache', false)).toBe(false);
  });

  it('a double star crosses directories', () => {
    expect(ignoredBy(rules, 'src/a/b/gen', true)).toBe(true);
  });

  it('a nested .gitignore applies under its own directory only', () => {
    const nested = rulesOf('web', 'tmp\n');
    expect(ignoredBy(nested, 'web/tmp', true)).toBe(true);
    expect(ignoredBy(nested, 'tmp', true)).toBe(false);
  });
});

describe('the folder snapshot', () => {
  it('build output and dependencies are never walked', () => {
    expect(['node_modules', '.git', 'dist', '.next', '.svelte-kit'].map(keptDir)).toEqual([false, false, false, false, false]);
    expect(keptDir('src')).toBe(true);
  });

  it('packs the kept files under the folder name and leaves out the ignored ones', async () => {
    const done = await snapshotOf('my app', [file('package.json', '{}'), file('.gitignore', '*.log\n'), file('src/main.ts', 'x'), file('debug.log', 'no'), file('node_modules/a/index.js', 'no'), sized('assets/huge.mp4', SNAPSHOT_LIMITS.fileBytes + 1)]);

    expect(done.ok).toBe(true);
    if (!done.ok) {
      return;
    }
    expect(done.name).toBe('my-app');
    const files = untarred(gunzipSync(done.archive));
    expect([...files.keys()].sort()).toEqual(['.gitignore', 'package.json', 'src/main.ts']);
    expect(done.skipped).toEqual(['assets/huge.mp4']);
  });

  it('a folder without package.json is refused', async () => {
    const done = await snapshotOf('x', [file('index.html', '<p>')]);
    expect(done).toEqual({ ok: false, refusal: SnapshotRefusal.NoPackage });
  });

  it('a folder over the total cap is refused before anything is read', async () => {
    const many = Array.from({ length: 30 }, (_, i) => sized(`src/f${i}.ts`, SNAPSHOT_LIMITS.fileBytes));
    const done = await snapshotOf('x', [file('package.json', '{}'), ...many]);
    expect(done).toEqual({ ok: false, refusal: SnapshotRefusal.TooBig });
  });
});
