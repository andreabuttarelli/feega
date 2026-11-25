import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { turnWatch } from './turn-changes';

const project = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), 'turn-changes-'));
  const put = (path: string, text: string) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  Object.entries(files).forEach(([path, text]) => put(path, text));
  return { root, put, drop: (path: string) => rmSync(join(root, path)) };
};

describe('the changes an agent makes behind our back', () => {
  it('reports an edited file with its content before the turn', async () => {
    const { root, put } = project({ 'src/App.tsx': 'old\n' });
    const watch = turnWatch(root);
    await watch.begin();

    put('src/App.tsx', 'new\n');

    expect(await watch.settle()).toEqual([{ path: 'src/App.tsx', before: 'old\n', after: 'new\n' }]);
  });

  it('reports a created file with an empty before', async () => {
    const { root, put } = project({ 'a.txt': 'a' });
    const watch = turnWatch(root);
    await watch.begin();

    put('src/New.tsx', 'fresh\n');

    expect(await watch.settle()).toEqual([{ path: 'src/New.tsx', before: '', after: 'fresh\n' }]);
  });

  it('reports a deleted file with an empty after', async () => {
    const { root, drop } = project({ 'src/Gone.tsx': 'bye\n' });
    const watch = turnWatch(root);
    await watch.begin();

    drop('src/Gone.tsx');

    expect(await watch.settle()).toEqual([{ path: 'src/Gone.tsx', before: 'bye\n', after: '' }]);
  });

  it('reports nothing when the agent touched nothing', async () => {
    const { root } = project({ 'a.txt': 'a' });
    const watch = turnWatch(root);
    await watch.begin();

    expect(await watch.settle()).toEqual([]);
  });

  it('skips the folders Feega never scans', async () => {
    const { root, put } = project({ 'a.txt': 'a' });
    const watch = turnWatch(root);
    await watch.begin();

    put('node_modules/pkg/index.js', 'x');
    put('dist/out.js', 'x');

    expect(await watch.settle()).toEqual([]);
  });

  it('skips what .gitignore hides and sees what it does not', async () => {
    const { root, put } = project({ '.gitignore': 'secret.env\n', 'a.txt': 'a' });
    execFileSync('git', ['init', '-q'], { cwd: root });
    const watch = turnWatch(root);
    await watch.begin();

    put('secret.env', 'KEY=1');
    put('b.txt', 'b');

    expect(await watch.settle()).toEqual([{ path: 'b.txt', before: '', after: 'b' }]);
  });

  it('does not repeat a file the agent wrote through us', async () => {
    const { root, put } = project({ 'src/App.tsx': 'old\n' });
    const watch = turnWatch(root);
    await watch.begin();

    put('src/App.tsx', 'new\n');
    watch.wrote('src/App.tsx', 'new\n');

    expect(await watch.settle()).toEqual([]);
  });

  it('keeps a direct edit made after a write through us', async () => {
    const { root, put } = project({ 'src/App.tsx': 'old\n' });
    const watch = turnWatch(root);
    await watch.begin();

    watch.wrote('src/App.tsx', 'middle\n');
    put('src/App.tsx', 'last\n');

    expect(await watch.settle()).toEqual([{ path: 'src/App.tsx', before: 'middle\n', after: 'last\n' }]);
  });

  it('ignores binary files', async () => {
    const { root, put } = project({ 'a.txt': 'a' });
    const watch = turnWatch(root);
    await watch.begin();

    put('logo.png', 'PNG\0data');

    expect(await watch.settle()).toEqual([]);
  });
});
