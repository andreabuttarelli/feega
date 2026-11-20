import { describe, expect, it } from 'vitest';
import { eventsOf } from './event-handlers';

const at = (file: string, line = 1, col = 1) => ({ file, line, col });
const readers = (files: Record<string, string>) => async (path: string) => files[path] ?? null;

describe('eventsOf', () => {
  it('lists a React handler by name, pointing at its declaration', async () => {
    const source = `function save() {}\nexport const A = () => <button onClick={save}>x</button>;`;
    const out = await eventsOf(readers({ 'A.tsx': source }), at('A.tsx', 2, 24));

    expect(out).toEqual([{ attribute: 'onClick', event: 'click', handler: 'save', at: { file: 'A.tsx', line: 1, col: 10 } }]);
  });

  it('calls an arrow function inline and points at the attribute', async () => {
    const source = `<button onClick={() => go('/x')}>x</button>`;
    const out = await eventsOf(readers({ 'A.tsx': source }), at('A.tsx'));

    expect(out).toEqual([{ attribute: 'onClick', event: 'click', handler: null, at: { file: 'A.tsx', line: 1, col: 9 } }]);
  });

  it('reads Svelte 5 lowercase handlers', async () => {
    const out = await eventsOf(readers({ 'a.svelte': `<button onclick={() => goto('/x')} onmouseenter={hover}>x</button>` }), at('a.svelte'));

    expect(out.map((e) => [e.attribute, e.event, e.handler])).toEqual([['onclick', 'click', null], ['onmouseenter', 'mouseenter', 'hover']]);
  });

  it('reads Svelte 4 directives with modifiers', async () => {
    const out = await eventsOf(readers({ 'a.svelte': `<button on:click|preventDefault={open}>x</button>` }), at('a.svelte'));

    expect(out.map((e) => [e.attribute, e.event, e.handler])).toEqual([['on:click|preventDefault', 'click', 'open']]);
  });

  it('reads Vue handlers in every spelling', async () => {
    const source = `<template>\n  <button @click.prevent="open" v-on:keydown="a = 1">x</button>\n</template>`;
    const out = await eventsOf(readers({ 'A.vue': source }), at('A.vue', 2, 3));

    expect(out.map((e) => [e.attribute, e.event, e.handler])).toEqual([['@click.prevent', 'click', 'open'], ['v-on:keydown', 'keydown', null]]);
  });

  it('finds a handler declared in an imported module', async () => {
    const files = { 'A.tsx': `import { save } from './h';\n<button onClick={save}>x</button>`, 'h.ts': `export function save() {}\n` };
    const out = await eventsOf(readers(files), at('A.tsx', 2, 1));

    expect(out[0].at).toEqual({ file: 'h.ts', line: 1, col: 17 });
  });

  it('ignores attributes that only look like events', async () => {
    const out = await eventsOf(readers({ 'A.tsx': `<input once="1" only="x" online />` }), at('A.tsx'));

    expect(out).toEqual([]);
  });

  it('returns nothing for an element without handlers', async () => {
    expect(await eventsOf(readers({ 'A.tsx': `<div class="x" />` }), at('A.tsx'))).toEqual([]);
  });
});
