import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Watch } from './file-watch';
import { classIndex, classesAt } from './classes';

const project = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), 'feega-classes-'));
  const put = (name: string, text: string, mtime = Date.now() / 1000) => {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
    utimesSync(join(root, name), mtime, mtime);
  };
  Object.entries(files).forEach(([name, text]) => put(name, text));
  return { root, put };
};

const fakeWatch = () => {
  let fire = () => undefined as void;
  const watch: Watch = (_root, changed) => {
    fire = changed;
    return { dispose: () => undefined };
  };
  return { watch, fire: () => fire() };
};

const PAGE = `<ul>\n  <li class="card">a</li>\n  <li\n    class="card big {tone}"\n  >b</li>\n</ul>\n`;

describe('classIndex', () => {
  it('indexes the stylesheets and the markup of the project', async () => {
    const { root } = project({ 'src/app.css': '.card { padding: 8px; }\n', 'src/Page.svelte': PAGE, 'src/Other.svelte': '<p class="card"></p>' });
    const index = await classIndex(root, {}).snapshot();

    expect(index.get('card')!.uses.length).toBe(3);
    expect(index.get('card')!.home!.file).toBe('src/app.css');
  });

  it('reads again only the files whose time changed', async () => {
    const { root, put } = project({ 'a.css': '.a { color: red; }', 'b.css': '.b { color: red; }' });
    const { watch, fire } = fakeWatch();
    const index = classIndex(root, { watch });
    await index.snapshot();
    const first = index.reads();

    put('b.css', '.b { color: blue; }', Date.now() / 1000 + 5);
    fire();
    const after = await index.snapshot();

    expect(index.reads() - first).toBe(1);
    expect(after.get('b')!.home!.declarations).toEqual({ color: 'blue' });
  });

  it('forgets a deleted file', async () => {
    const { root, put } = project({ 'a.css': '.a { color: red; }' });
    const { watch, fire } = fakeWatch();
    const index = classIndex(root, { watch });
    await index.snapshot();

    put('a.css', '', Date.now() / 1000 + 5);
    fire();

    expect((await index.snapshot()).has('a')).toBe(false);
  });
});

describe('classesAt', () => {
  const files = { 'src/app.css': '.card { padding: 8px; }\n.big { font-size: 20px; }\n', 'src/Page.svelte': PAGE };

  it('lists the classes of the element at a position, multiline tag included', async () => {
    const { root } = project(files);
    const view = await classesAt(root, await classIndex(root, {}).snapshot(), 'src/Page.svelte:3:3');

    expect(view.element.map((c) => c.name)).toEqual(['card', 'big']);
    expect(view.dynamic).toBe(true);
  });

  it('counts elements and files of each class', async () => {
    const { root } = project({ ...files, 'src/Other.svelte': '<p class="card"></p>' });
    const view = await classesAt(root, await classIndex(root, {}).snapshot(), 'src/Page.svelte:2:3');

    expect(view.element.map((c) => [c.name, c.elements, c.files])).toEqual([['card', 3, 2]]);
  });

  it('lists the classes the file of the element uses', async () => {
    const { root } = project(files);
    const view = await classesAt(root, await classIndex(root, {}).snapshot(), 'src/Page.svelte:2:3');

    expect(view.inFile.map((c) => c.name).sort()).toEqual(['big', 'card']);
  });

  it('caps the uses it sends and keeps the real counts', async () => {
    const many = Array.from({ length: 400 }, () => '<i class="card"></i>').join('\n');
    const { root } = project({ 'src/app.css': '.card { color: red; }', 'src/Many.svelte': many });
    const view = await classesAt(root, await classIndex(root, {}).snapshot(), 'src/Many.svelte:1:1');

    expect(view.element[0].elements).toBe(400);
    expect(view.element[0].uses.length).toBeLessThan(400);
  });

  it('answers empty for a position that is not an element', async () => {
    const { root } = project(files);
    const view = await classesAt(root, await classIndex(root, {}).snapshot(), 'src/Page.svelte:1:1');

    expect(view.element.map((c) => c.name)).toEqual([]);
  });
});
