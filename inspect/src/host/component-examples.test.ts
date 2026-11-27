import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { examplesOf } from './component-examples';

function project(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'feega-examples-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }

  return root;
}

const PAGE = 'src/routes/+page.svelte';

describe('examplesOf literals', () => {
  it('turns every use of the component into an example with its file and line', async () => {
    const root = project({ [PAGE]: '<h1>Hi</h1>\n<Card title="A" n={1} />\n\n<Card title="B" />' });

    const examples = await examplesOf(root, 'Card', [PAGE]);

    expect(examples.map((e) => [e.id, e.file, e.line, e.props])).toEqual([
      [`${PAGE}:2`, PAGE, 2, { title: 'A', n: 1 }],
      [`${PAGE}:4`, PAGE, 4, { title: 'B' }]
    ]);
  });

  it('reads the Vue binding and React brace forms', async () => {
    const root = project({ 'src/A.vue': '<template><Card :n="3" title="Hi" /></template>', 'src/B.tsx': 'export const B = () => <Card n={4} open />;' });

    const [vue] = await examplesOf(root, 'Card', ['src/A.vue']);
    const [react] = await examplesOf(root, 'Card', ['src/B.tsx']);

    expect(vue.props).toEqual({ n: 3, title: 'Hi' });
    expect(react.props).toEqual({ n: 4, open: true });
  });

  it('is empty when no file renders the component', async () => {
    const root = project({ [PAGE]: '<div />' });

    expect(await examplesOf(root, 'Card', [PAGE])).toEqual([]);
  });

  it('does not take a component whose name only starts the same', async () => {
    const root = project({ [PAGE]: '<CardHeader title="x" />' });

    expect(await examplesOf(root, 'Card', [PAGE])).toEqual([]);
  });
});

describe('examplesOf identifiers', () => {
  it('follows a const defined in the same file, plain and by member', async () => {
    const root = project({ [PAGE]: "<script lang=\"ts\">\n  const quiz = { title: 'Q', levels: [{ id: 1 }] };\n</script>\n<Card {quiz} t={quiz.title} first={quiz.levels[0]} />" });

    const [example] = await examplesOf(root, 'Card', [PAGE]);

    expect(example.props).toEqual({ quiz: { title: 'Q', levels: [{ id: 1 }] }, t: 'Q', first: { id: 1 } });
    expect(example.unresolved).toEqual([]);
  });

  it('follows a default import of a json file through the $lib alias', async () => {
    const root = project({ 'src/lib/data/quizzes.json': '[{"id":"a","questions":[1,2]}]', [PAGE]: "<script>\n  import quizzes from '$lib/data/quizzes.json';\n</script>\n<Card quiz={quizzes[0]} />" });

    expect((await examplesOf(root, 'Card', [PAGE]))[0].props).toEqual({ quiz: { id: 'a', questions: [1, 2] } });
  });

  it('follows a named import of a ts module, with an as const tail', async () => {
    const root = project({ 'src/lib/data.ts': "export const QUIZ: Quiz = { title: 'T', n: 2 } as const;", [PAGE]: "<script>\n  import { QUIZ } from '$lib/data';\n</script>\n<Card quiz={QUIZ} />" });

    expect((await examplesOf(root, 'Card', [PAGE]))[0].props).toEqual({ quiz: { title: 'T', n: 2 } });
  });

  it('follows a relative import and a constant that uses another import of its module', async () => {
    const root = project({
      'src/lib/base.ts': "export const LEVELS = [{ id: 1 }, { id: 2 }];",
      'src/lib/quiz.ts': "import { LEVELS } from './base';\nexport const quiz = { title: 'T', levels: LEVELS };",
      'src/routes/a/+page.svelte': "<script>\n  import { quiz } from '../../lib/quiz';\n</script>\n<Card {quiz} />"
    });

    expect((await examplesOf(root, 'Card', ['src/routes/a/+page.svelte']))[0].props).toEqual({ quiz: { title: 'T', levels: [{ id: 1 }, { id: 2 }] } });
  });

  it('follows a named import of a key of a json file', async () => {
    const root = project({ 'src/data.json': '{"site":{"name":"Tra i Due"}}', [PAGE]: "<script>\n  import { site } from '../data.json';\n</script>\n<Card name={site.name} />" });

    expect((await examplesOf(root, 'Card', [PAGE]))[0].props).toEqual({ name: 'Tra i Due' });
  });

  it('reads a React file whose const lives at the top of the file', async () => {
    const root = project({ 'src/P.tsx': "const items = ['a', 'b'];\nexport const P = () => <List items={items} />;" });

    expect((await examplesOf(root, 'List', ['src/P.tsx']))[0].props).toEqual({ items: ['a', 'b'] });
  });
});

describe('examplesOf what it cannot know', () => {
  it('lists as unresolved the props that come from load data, calls and props', async () => {
    const root = project({ [PAGE]: "<script>\n  let { data } = $props();\n  import { quizzes } from '$lib/q';\n</script>\n<Card quiz={data.quiz} found={quizzes.find((q) => q.id === 1)} label=\"ok\" {title} />" });

    const [example] = await examplesOf(root, 'Card', [PAGE]);

    expect(example.props).toEqual({ label: 'ok' });
    expect(example.unresolved).toEqual(['quiz', 'found', 'title']);
  });

  it('survives a missing or unreadable import', async () => {
    const root = project({ [PAGE]: "<script>\n  import { x } from '$lib/nope';\n</script>\n<Card {x} />" });

    expect((await examplesOf(root, 'Card', [PAGE]))[0].unresolved).toEqual(['x']);
  });

  it('survives an import cycle', async () => {
    const root = project({ 'src/lib/a.ts': "import { b } from './b';\nexport const a = b;", 'src/lib/b.ts': "import { a } from './a';\nexport const b = a;", [PAGE]: "<script>\n  import { a } from '$lib/a';\n</script>\n<Card {a} />" });

    expect((await examplesOf(root, 'Card', [PAGE]))[0].unresolved).toEqual(['a']);
  });

  it('never leaves the project', async () => {
    const root = project({ [PAGE]: "<script>\n  import x from '../../../../etc/passwd.json';\n</script>\n<Card {x} />" });

    expect((await examplesOf(root, 'Card', [PAGE]))[0].unresolved).toEqual(['x']);
  });
});
