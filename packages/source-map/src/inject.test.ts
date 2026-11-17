import { describe, expect, it } from 'vitest';
import { injectSource } from './inject.ts';

const tagsOf = (code: string) => [...code.matchAll(/<(\w+)[^>]*data-feega-src="([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`);

describe('injectSource', () => {
  it('tags JSX host elements with file:line:col', () => {
    const code = `export const A = () => (\n  <div className="a">\n    <span>hi</span>\n  </div>\n);\n`;

    const out = injectSource(code, 'src/A.jsx');

    expect(tagsOf(out!)).toEqual(['div src/A.jsx:2:3', 'span src/A.jsx:3:5']);
  });

  it('parses TSX with type annotations and generics', () => {
    const code = `type P = { n: number };\nexport function B<T,>({ n }: P) {\n  return <p data-n={n as number}>{n}</p>;\n}\n`;

    const out = injectSource(code, 'app/B.tsx');

    expect(tagsOf(out!)).toEqual(['p app/B.tsx:3:10']);
  });

  it('leaves components, fragments and member tags untagged in nested trees', () => {
    const code = `import { Card } from './Card';\nexport default () => (\n  <>\n    <Card>\n      <motion.div />\n      <section><h1>t</h1></section>\n    </Card>\n  </>\n);\n`;

    const out = injectSource(code, 'src/Page.tsx')!;

    expect(tagsOf(out)).toEqual(['section src/Page.tsx:6:7', 'h1 src/Page.tsx:6:16']);
    expect(out).toContain('<Card>');
    expect(out).toContain('<motion.div />');
  });

  it('does not tag an element twice', () => {
    const code = `export const A = () => <div data-feega-src="x:1:1" />;\n`;

    expect(injectSource(code, 'A.jsx')).toBeNull();
  });

  it('tags Svelte elements, also inside blocks, and skips components', () => {
    const code = `<script lang="ts">\n  import Card from './Card.svelte';\n  let items: string[] = [];\n</script>\n\n<main>\n  {#each items as item}\n    <Card><li>{item}</li></Card>\n  {/each}\n</main>\n`;

    const out = injectSource(code, 'src/App.svelte')!;

    expect(tagsOf(out)).toEqual(['main src/App.svelte:6:1', 'li src/App.svelte:8:11']);
    expect(out).toContain('<Card>');
  });

  it('ignores files it cannot map', () => {
    expect(injectSource('body { color: red }', 'a.css')).toBeNull();
  });
});
