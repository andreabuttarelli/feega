import { describe, expect, it } from 'vitest';
import { ClassScope } from './class-rules';
import { buildIndex, duplicatesOf, entryOf, factsOf, type FileFacts } from './class-index';

const facts = (files: Record<string, string>): Map<string, FileFacts> => new Map(Object.entries(files).map(([file, text]) => [file, factsOf(file, text)]));

const SITE = `<ul>\n  <li class="card">a</li>\n  <li class="card big">b</li>\n</ul>\n`;

describe('buildIndex', () => {
  it('counts elements and files of a global class and ignores classes with no rule', () => {
    const index = buildIndex(facts({ 'app.css': '.card { padding: 8px; }\n', 'a.html': SITE, 'b.html': '<p class="card flex"></p>' }));
    const card = index.get('card')!;

    expect(card.uses.length).toBe(3);
    expect(new Set(card.uses.map((u) => u.file)).size).toBe(2);
    expect(index.has('flex')).toBe(false);
    expect(index.has('big')).toBe(false);
  });

  it('home is the first own rule without state or media', () => {
    const index = buildIndex(facts({ 'app.css': '.card:hover { color: red; }\n@media (max-width: 1px) { .card { color: blue; } }\n.card { padding: 8px; }\n' }));

    expect(index.get('card')!.home).toMatchObject({ line: 3, state: '', media: '' });
  });

  it('keeps module classes apart by sheet', () => {
    const index = buildIndex(
      facts({
        'src/A.module.css': '.title { color: red; }\n',
        'src/B.module.css': '.title { color: blue; }\n',
        'src/A.tsx': "import s from './A.module.css';\n<p className={s.title} />",
        'src/B.tsx': "import s from './B.module.css';\n<p className={s.title} /><i className={s.title} />"
      })
    );

    expect(index.get('src/A.module.css#title')!.uses.length).toBe(1);
    expect(index.get('src/B.module.css#title')!.uses.length).toBe(2);
    expect(index.get('src/A.module.css#title')!.scope).toBe(ClassScope.Module);
  });

  it('a component style class takes the uses of its own file only', () => {
    const index = buildIndex(
      facts({
        'src/A.svelte': '<p class="x"></p>\n<style>\n.x { color: red; }\n</style>',
        'src/B.svelte': '<p class="x"></p>\n<style>\n.x { color: blue; }\n</style>'
      })
    );

    expect(index.get('src/A.svelte#x')!.uses.map((u) => u.file)).toEqual(['src/A.svelte']);
    expect(index.get('src/B.svelte#x')!.uses.map((u) => u.file)).toEqual(['src/B.svelte']);
  });

  it('keeps the dynamic mark of a use', () => {
    const index = buildIndex(facts({ 'a.css': '.on { color: red; }', 'A.tsx': '<p className={`on ${t}`} />' }));

    expect(index.get('on')!.uses[0].dynamic).toBe(true);
  });
});

describe('entryOf', () => {
  it('finds the entry of a use from the file that holds it', () => {
    const all = facts({ 'src/A.module.css': '.t { color: red; }', 'app.css': '.g { color: red; }' });
    const index = buildIndex(all);

    expect(entryOf(index, { name: 'g', line: 1, dynamic: false, module: null }, 'x.tsx')!.key).toBe('g');
    expect(entryOf(index, { name: 't', line: 1, dynamic: false, module: 'src/A.module.css' }, 'src/A.tsx')!.key).toBe('src/A.module.css#t');
    expect(entryOf(index, { name: 'nope', line: 1, dynamic: false, module: null }, 'x.tsx')).toBeUndefined();
  });
});

describe('duplicatesOf', () => {
  it('groups classes whose own rule has the same declarations', () => {
    const index = buildIndex(facts({ 'a.css': '.a { color: red; padding: 4px; }\n.b { padding: 4px; color: red; }\n.c { color: red; }\n' }));

    expect(duplicatesOf(index).map((g) => g.map((e) => e.name))).toEqual([['a', 'b']]);
  });
});
