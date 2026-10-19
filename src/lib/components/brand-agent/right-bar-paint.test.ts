import { readFileSync } from 'node:fs';
import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./RightBar.svelte', import.meta.url), 'utf8');
const css = compile(source, { filename: 'RightBar.svelte' }).css?.code ?? '';
const ownRule = css.match(/\.right-bar\.svelte-[\w-]+\s*\{([^}]*)\}/)?.[1] ?? '';

describe('right bar paint', () => {
  it('paints its own background, so no slot it moves into leaves it transparent', () => {
    expect(ownRule).toMatch(/background:\s*var\(--ui-wash\)/);
  });
});
