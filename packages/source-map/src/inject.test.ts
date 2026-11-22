import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { injectSource } from './inject.ts';

const hasVueCompiler = (() => {
  try {
    createRequire(import.meta.url).resolve('@vue/compiler-sfc');
    return true;
  } catch {
    return false;
  }
})();

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

  it('tags a React icon usage with its component name, on the opening tag', () => {
    const code = `import { ArrowRight as Next, Heart } from 'lucide-react';\nexport const A = () => (\n  <main>\n    <Next size={32} />\n    <Heart />\n  </main>\n);\n`;

    const out = injectSource(code, 'src/App.jsx')!;

    expect(out).toContain('<Next data-feega-src="src/App.jsx:4:5" data-feega-icon="ArrowRight" size={32} />');
    expect(out).toContain('<Heart data-feega-src="src/App.jsx:5:5" data-feega-icon="Heart" />');
  });

  it('tags a default-imported Svelte icon', () => {
    const code = `<script>\n  import Heart from '@lucide/svelte/icons/heart';\n  import { Mail } from 'lucide-svelte';\n</script>\n\n<p><Heart size={16} /><Mail /></p>\n`;

    const out = injectSource(code, 'src/Nav.svelte')!;

    expect(out).toContain('<Heart data-feega-src="src/Nav.svelte:6:4" data-feega-icon="Heart" size={16} />');
    expect(out).toContain('<Mail data-feega-src="src/Nav.svelte:6:23" data-feega-icon="Mail" />');
  });

  it.skipIf(!hasVueCompiler)('tags a Vue icon, also written in kebab-case', () => {
    const code = `<script setup>\nimport { ArrowRight } from 'lucide-vue-next';\n</script>\n\n<template>\n  <button><ArrowRight :size="32" /><arrow-right /></button>\n</template>\n`;

    const out = injectSource(code, 'src/App.vue')!;

    expect(out).toContain('<ArrowRight data-feega-src="src/App.vue:6:11" data-feega-icon="ArrowRight" :size="32" />');
    expect(out).toContain('<arrow-right data-feega-src="src/App.vue:6:36" data-feega-icon="ArrowRight" />');
  });

  it('leaves components that do not come from an icon library untagged', () => {
    const code = `import { Heart } from './icons';\nimport { Button } from 'lucide-react-extras';\nexport const A = () => <p><Heart /><Button /></p>;\n`;

    expect(tagsOf(injectSource(code, 'src/A.jsx')!)).toEqual(['p src/A.jsx:3:24']);
    expect(injectSource(code, 'src/A.jsx')).not.toContain('data-feega-icon');
  });

  it('tags the other icon libraries by package', () => {
    const packages = ['react-icons/fa', '@heroicons/react/24/outline', '@tabler/icons-react', '@phosphor-icons/react'];

    for (const pkg of packages) {
      const out = injectSource(`import { Star } from '${pkg}';\nexport const A = () => <Star />;\n`, 'A.jsx');

      expect(out, pkg).toContain('<Star data-feega-src="A.jsx:2:24" data-feega-icon="Star" />');
    }
  });

  it('tags HTML elements with file:line:col, leaving the head and script bodies alone', () => {
    const code = `<!doctype html>\n<html>\n  <head><title>t</title></head>\n  <body>\n    <main class="a">\n      <h1>Hi</h1>\n      <img src="x.png">\n    </main>\n    <script>const a = '<p>';</script>\n  </body>\n</html>\n`;

    const out = injectSource(code, 'index.html')!;

    expect(tagsOf(out)).toEqual(['body index.html:4:3', 'main index.html:5:5', 'h1 index.html:6:7', 'img index.html:7:7']);
    expect(out).toContain('<img data-feega-src="index.html:7:7" src="x.png">');
  });

  it('tags Astro elements and skips components and the front matter', () => {
    const code = `---\nimport Card from './Card.astro';\nconst html = '<p>';\n---\n\n<main>\n  <Card><li>one</li></Card>\n  <h1 class="t">Hi</h1>\n</main>\n<style>\n  h1 { color: red }\n</style>\n`;

    const out = injectSource(code, 'src/pages/index.astro')!;

    expect(tagsOf(out)).toEqual(['main src/pages/index.astro:6:1', 'li src/pages/index.astro:7:9', 'h1 src/pages/index.astro:8:3']);
    expect(out).toContain('<Card>');
  });

  it('stamps Astro start tags after multibyte text, in maps, multi-line tags and self-closing tags', () => {
    const code = [
      '---',
      "const beans = [{ name: 'Huila Washed', note: 'Red apple', price: '€14' }];",
      '---',
      '<main>',
      '  <p>Café · Lisboa — à la carte</p>',
      '  {beans.map((b) => (',
      '    <article class="card">',
      '      <h3>{b.name}</h3>',
      '      <p>{b.note} · €</p>',
      '      <img',
      '        src="x.png"',
      '        alt="é"',
      '      />',
      '      <br />',
      '      <Card title="ü"><span>Sì</span></Card>',
      '    </article>',
      '  ))}',
      '  <footer>Fine</footer>',
      '</main>',
      ''
    ].join('\n');

    const out = injectSource(code, 'p.astro')!;

    expect(tagsOf(out)).toEqual([
      'main p.astro:4:1',
      'p p.astro:5:3',
      'article p.astro:7:5',
      'h3 p.astro:8:7',
      'p p.astro:9:7',
      'img p.astro:10:7',
      'br p.astro:14:7',
      'span p.astro:15:23',
      'footer p.astro:18:3'
    ]);
    expect(out.replace(/ data-feega-src="[^"]*"/g, '')).toBe(code);
  });
});
