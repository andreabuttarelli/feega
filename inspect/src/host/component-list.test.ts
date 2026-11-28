import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { componentsOf, folderOf, listComponents } from './component-list';

const file = (path: string, text = '') => ({ path, text });
const JSX_BODY = 'export function Card() { return <div />; }';

describe('componentsOf', () => {
  it('takes every svelte, vue and astro file as one component named after the file', () => {
    const found = componentsOf([file('src/lib/Button.svelte'), file('src/components/user-card.vue'), file('src/components/Hero.astro')]);

    expect(found.map((c) => c.name)).toEqual(['Button', 'UserCard', 'Hero']);
  });

  it('names an index file after its folder', () => {
    expect(componentsOf([file('src/components/Modal/index.svelte')]).map((c) => c.name)).toEqual(['Modal']);
  });

  it('skips the files that are pages, layouts and entries', () => {
    const found = componentsOf([
      file('src/routes/+page.svelte'),
      file('src/routes/+layout.svelte'),
      file('src/pages/index.astro'),
      file('pages/about.vue'),
      file('app/blog/page.tsx', JSX_BODY),
      file('src/main.tsx', JSX_BODY),
      file('src/lib/Keep.svelte')
    ]);

    expect(found.map((c) => c.name)).toEqual(['Keep']);
  });

  it('takes the capitalized exports of a react file, one component each', () => {
    const text = 'export function Card() { return <div />; }\nexport const Badge = () => <b />;\nexport const helper = 1;\nexport function useThing() {}';

    expect(componentsOf([file('src/ui/parts.tsx', text)]).map((c) => c.name)).toEqual(['Card', 'Badge']);
  });

  it('names a default export after the file', () => {
    expect(componentsOf([file('src/ui/Tabs.jsx', 'export default function () { return <ul />; }')]).map((c) => c.name)).toEqual(['Tabs']);
  });

  it('skips react files that render nothing, tests and type files', () => {
    const found = componentsOf([file('src/lib/types.ts', 'export type Card = {}'), file('src/lib/Plain.tsx', 'export const Limit = 3;'), file('src/ui/Card.test.tsx', JSX_BODY), file('src/ui/Card.stories.tsx', JSX_BODY)]);

    expect(found).toEqual([]);
  });

  it('keeps the file with each component', () => {
    expect(componentsOf([file('src/lib/Button.svelte')])).toEqual([{ name: 'Button', file: 'src/lib/Button.svelte' }]);
  });
});

describe('folderOf', () => {
  it('drops the leading src and keeps the folder', () => {
    expect(folderOf('src/lib/components/ui/Button.svelte')).toBe('lib/components/ui');
  });

  it('puts a file at the top of the project in the root group', () => {
    expect(folderOf('Button.svelte')).toBe('');
    expect(folderOf('src/Button.svelte')).toBe('');
  });
});

describe('listComponents', () => {
  function project(files: Record<string, string>) {
    const root = mkdtempSync(join(tmpdir(), 'feega-components-'));
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return root;
  }

  it('lists the components of the project with folder and usage count, sorted', async () => {
    const root = project({
      'src/lib/ui/Button.svelte': '<button />',
      'src/lib/Card.svelte': '<div />',
      'src/routes/+page.svelte': '<Card />',
      'node_modules/pkg/Skipped.svelte': '<i />'
    });

    const rows = await listComponents(root, async (path) => (path.endsWith('Card.svelte') ? ['src/routes/+page.svelte', 'src/routes/+page.svelte', 'src/routes/+page.svelte'] : []));

    expect(rows).toEqual([
      { name: 'Card', file: 'src/lib/Card.svelte', folder: 'lib', uses: 3, examples: [{ id: 'src/routes/+page.svelte:1', file: 'src/routes/+page.svelte', line: 1, props: {}, unresolved: [] }] },
      { name: 'Button', file: 'src/lib/ui/Button.svelte', folder: 'lib/ui', uses: 0, examples: [] }
    ]);
  });

  it('gives each component an example for every place that uses it', async () => {
    const root = project({
      'src/lib/Card.svelte': '<div />',
      'src/routes/a/+page.svelte': '<Card {item} />',
      'src/routes/b/+page.svelte': '<Card title="Domanda 1" n={3} />'
    });

    const [card] = await listComponents(root, async () => ['src/routes/a/+page.svelte', 'src/routes/b/+page.svelte']);

    expect(card.examples.map((e) => [e.file, e.props, e.unresolved])).toEqual([
      ['src/routes/a/+page.svelte', {}, ['item']],
      ['src/routes/b/+page.svelte', { title: 'Domanda 1', n: 3 }, []]
    ]);
  });
});
