import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { editorFor, editorRegistry, missingText, type EditorEntry } from './editors';

const entry = (over: Partial<EditorEntry> = {}): EditorEntry => ({ projectRoot: '/work/shop', port: 4001, token: 't', pid: 10, lastActiveAt: 1, ...over });

describe('editorFor', () => {
  it('takes the editor whose project contains the folder', () => {
    expect(editorFor([entry()], { cwd: '/work/shop/src' })).toEqual(entry());
  });

  it('ignores a project that does not contain the folder', () => {
    expect(editorFor([entry({ projectRoot: '/work/shop-2' })], { cwd: '/work/shop' })).toBeNull();
  });

  it('prefers the deepest project in a monorepo', () => {
    const deep = entry({ projectRoot: '/work/shop/apps/web', port: 4002 });

    expect(editorFor([entry(), deep], { cwd: '/work/shop/apps/web/src' })).toEqual(deep);
  });

  it('prefers the most recently active of two windows on one project', () => {
    const recent = entry({ port: 4002, lastActiveAt: 9 });

    expect(editorFor([entry(), recent], { cwd: '/work/shop' })).toEqual(recent);
  });

  it('a project argument overrides the folder', () => {
    const other = entry({ projectRoot: '/work/blog', port: 4003 });

    expect(editorFor([entry(), other], { cwd: '/work/shop', project: '/work/blog' })).toEqual(other);
  });
});

describe('missingText', () => {
  it('tells to open Feega when no editor runs', () => {
    expect(missingText([])).toBe('No Feega editor is running. Open Feega in this project first: npx feega or the VS Code panel.');
  });

  it('names the projects that have Feega open', () => {
    expect(missingText([entry(), entry({ projectRoot: '/work/blog' })])).toContain('Feega is open in /work/shop, /work/blog');
  });
});

describe('editorRegistry', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'feega-editors-'));

  it('lists what was saved', () => {
    const registry = editorRegistry({ dir: dir(), alive: () => true });
    registry.save(entry());

    expect(registry.list()).toEqual([entry()]);
  });

  it('drops and deletes entries whose process is gone', () => {
    const where = dir();
    const registry = editorRegistry({ dir: where, alive: (pid) => pid !== 10 });
    registry.save(entry());
    registry.save(entry({ pid: 11, port: 4002 }));

    expect(registry.list().map((e) => e.pid)).toEqual([11]);
    expect(readdirSync(where)).toHaveLength(1);
  });

  it('skips a file that is not an entry', () => {
    const where = dir();
    writeFileSync(join(where, 'junk.json'), '{');

    expect(editorRegistry({ dir: where, alive: () => true }).list()).toEqual([]);
  });

  it('lists nothing when the folder does not exist yet', () => {
    expect(editorRegistry({ dir: join(dir(), 'none'), alive: () => true }).list()).toEqual([]);
  });

  it('removes an entry', () => {
    const registry = editorRegistry({ dir: dir(), alive: () => true });
    registry.save(entry());
    registry.drop(entry());

    expect(registry.list()).toEqual([]);
  });
});
