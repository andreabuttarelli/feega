import { describe, expect, it } from 'vitest';
import { detachComponent, type DetachAsk } from './detach-component';

const BUTTON_TSX = `export function Button({ children }) {
  return (
    <button className="p-2">
      Button {children}
    </button>
  );
}

Button.displayName = 'Button';

export default Button;
`;

const HOME_TSX = `import { Button } from './Button';

export default function Home() {
  return (
    <main>
      <section>
        <Button>Buy</Button>
      </section>
      <Button>Other</Button>
    </main>
  );
}
`;

const PRICING_SVELTE = `<script>
  import Button from '~/lib/Button.svelte';
</script>

<section>
  <Button label="a" />
</section>
`;

const BUTTON_SVELTE = `<button class="p-2">{label}</button>
`;

const VUE_PAGE = `<script setup>
import Button from './Button.vue';
</script>

<template>
  <section>
    <button-x />
    <Button label="a" />
  </section>
</template>
`;

const ASTRO_PAGE = `---
import Button from '../components/Button.astro';
---

<section>
  <Button label="a" />
</section>
`;

const PAGE = 'src/routes/home/page.tsx';

const files = (entries: Record<string, string>) => async (path: string) => entries[path] ?? null;

const REACT_FILES = { 'src/Button.tsx': BUTTON_TSX, [PAGE]: HOME_TSX };

const ask = (over: Partial<DetachAsk> = {}): DetachAsk => ({
  element: { file: 'src/Button.tsx', line: 3, col: 5 },
  usage: { file: PAGE, line: 6, col: 7 },
  ...over
});

describe('detachComponent', () => {
  it('copies the component beside the original under a name from the route', async () => {
    const out = await detachComponent(files(REACT_FILES), ask());

    const copy = out.ok && out.changes.find((c) => c.path === 'src/ButtonHome.tsx');
    expect(copy && copy.before).toBe('');
    expect(copy && copy.after).toBe(
      BUTTON_TSX.replace('export function Button(', 'export function ButtonHome(').replace('Button.displayName', 'ButtonHome.displayName').replace('export default Button;', 'export default ButtonHome;')
    );
  });

  it('rewrites the import and only the chosen usage in React', async () => {
    const out = await detachComponent(files(REACT_FILES), ask());

    const page = out.ok && out.changes.find((c) => c.path === PAGE);
    expect(page && page.after).toBe(
      HOME_TSX.replace("import { Button } from './Button';\n", "import { Button } from './Button';\nimport { ButtonHome } from './ButtonHome';\n").replace('<Button>Buy</Button>', '<ButtonHome>Buy</ButtonHome>')
    );
  });

  it('selects the element in the copy', async () => {
    const out = await detachComponent(files(REACT_FILES), ask());

    expect(out.ok && out.selected).toEqual({ file: 'src/ButtonHome.tsx', line: 3, col: 5 });
  });

  it('picks a free name when the copy already exists', async () => {
    const out = await detachComponent(files({ ...REACT_FILES, 'src/ButtonHome.tsx': 'x' }), ask());

    expect(out.ok && out.changes.map((c) => c.path)).toContain('src/ButtonHome2.tsx');
  });

  it('names the copy after the route folder for a +page file', async () => {
    const out = await detachComponent(files({ 'src/lib/Button.svelte': BUTTON_SVELTE, 'src/routes/pricing/+page.svelte': PRICING_SVELTE }), {
      element: { file: 'src/lib/Button.svelte', line: 1, col: 1 },
      usage: { file: 'src/routes/pricing/+page.svelte', line: 5, col: 1 }
    });

    expect(out.ok && out.changes.map((c) => c.path)).toEqual(['src/lib/ButtonPricing.svelte', 'src/routes/pricing/+page.svelte']);
    expect(out.ok && out.changes[1].after).toBe(
      PRICING_SVELTE.replace("import Button from '~/lib/Button.svelte';", "import Button from '~/lib/Button.svelte';\n  import ButtonPricing from '~/lib/ButtonPricing.svelte';").replace('<Button label="a" />', '<ButtonPricing label="a" />')
    );
  });

  it('rewrites a Vue usage and its import', async () => {
    const out = await detachComponent(files({ 'src/Button.vue': BUTTON_SVELTE, 'src/Page.vue': VUE_PAGE }), {
      element: { file: 'src/Button.vue', line: 1, col: 1 },
      usage: { file: 'src/Page.vue', line: 6, col: 3 }
    });

    expect(out.ok && out.changes[1].after).toBe(
      VUE_PAGE.replace("import Button from './Button.vue';", "import Button from './Button.vue';\nimport ButtonPage from './ButtonPage.vue';").replace('<Button label="a" />', '<ButtonPage label="a" />')
    );
  });

  it('rewrites an Astro usage and its import', async () => {
    const out = await detachComponent(files({ 'src/components/Button.astro': BUTTON_SVELTE, 'src/pages/index.astro': ASTRO_PAGE }), {
      element: { file: 'src/components/Button.astro', line: 1, col: 1 },
      usage: { file: 'src/pages/index.astro', line: 5, col: 1 }
    });

    expect(out.ok && out.changes.map((c) => c.path)).toEqual(['src/components/ButtonHome.astro', 'src/pages/index.astro']);
    expect(out.ok && out.changes[1].after).toContain("import ButtonHome from '../components/ButtonHome.astro';");
    expect(out.ok && out.changes[1].after).toContain('<ButtonHome label="a" />');
  });

  it('refuses a component imported through a re-export', async () => {
    const out = await detachComponent(files({ ...REACT_FILES, [PAGE]: HOME_TSX.replace("'./Button'", "'./components'") }), ask());

    expect(out).toEqual({ ok: false, reason: `${PAGE}: Button is not imported straight from its file (a re-export?)` });
  });

  it('refuses a usage rendered in a loop', async () => {
    const page = HOME_TSX.replace('<Button>Buy</Button>', '{xs.map((x) => (\n          <Button key={x}>Buy</Button>\n        ))}');
    const out = await detachComponent(files({ ...REACT_FILES, [PAGE]: page }), ask());

    expect(out).toEqual({ ok: false, reason: `${PAGE}: the usage is rendered in a loop: every iteration shares it` });
  });

  it('refuses when the element holds more than one usage', async () => {
    const out = await detachComponent(files(REACT_FILES), ask({ usage: { file: PAGE, line: 5, col: 5 } }));

    expect(out).toEqual({ ok: false, reason: `${PAGE}: 2 <Button> usages in this element: cannot tell which one this is` });
  });

  it('detaches the usage the editor names among several in one element', async () => {
    const out = await detachComponent(files(REACT_FILES), ask({ usage: { file: PAGE, line: 5, col: 5 }, which: { index: 1, count: 2 } }));

    const page = out.ok && out.changes.find((c) => c.path === PAGE);
    expect(page && page.after).toContain('<Button>Buy</Button>');
    expect(page && page.after).toContain('<ButtonHome>Other</ButtonHome>');
  });

  it('refuses when the page shows a different number of usages than the source holds', async () => {
    const out = await detachComponent(files(REACT_FILES), ask({ usage: { file: PAGE, line: 5, col: 5 }, which: { index: 0, count: 3 } }));

    expect(out).toEqual({ ok: false, reason: `${PAGE}: 2 <Button> usages in this element: cannot tell which one this is` });
  });

  it('refuses when no usage of the component is written there', async () => {
    const out = await detachComponent(files({ ...REACT_FILES, [PAGE]: HOME_TSX.replace('<Button>Buy</Button>', '<Dynamic>Buy</Dynamic>') }), ask());

    expect(out).toEqual({ ok: false, reason: `${PAGE}: no <Button> usage in this element (a dynamic component?)` });
  });

  it('refuses a file kind it cannot copy', async () => {
    const out = await detachComponent(files({ 'src/button.ts': 'x', [PAGE]: HOME_TSX }), { element: { file: 'src/button.ts', line: 1, col: 1 }, usage: { file: PAGE, line: 5, col: 5 } });

    expect(out).toEqual({ ok: false, reason: 'src/button.ts: detach works on React, Svelte, Vue and Astro components' });
  });
});
