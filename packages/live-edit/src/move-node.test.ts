import { describe, expect, it } from 'vitest';
import { Place, moveNode } from './move-node';

const SVELTE = `<nav class="links">
  <a href="/docs">Docs</a>
  <a href="/pricing">Pricing <b>new</b></a>
  <a href="/blog">Blog</a>
</nav>
`;

const JSX = `export function Nav() {
  return (
    <nav>
      <Link to="/docs" />
      <span>Pricing</span>
    </nav>
  );
}
`;

const EACH = `<ul>
  {#each items as item}
    <li>{item}</li>
  {/each}
  <li>last</li>
</ul>
`;

const at = (file: string, line: number, col: number) => ({ file, line, col });
const run = (text: string, file: string, from: [number, number], to: [number, number], place: Place) => moveNode(async () => text, at(file, ...from), at(file, ...to), place);

describe('moveNode', () => {
  it('moves a Svelte element with its subtree after a sibling', async () => {
    const out = await run(SVELTE, 'Nav.svelte', [3, 3], [4, 3], Place.After);

    expect(out.ok && out.change.after).toBe(`<nav class="links">
  <a href="/docs">Docs</a>
  <a href="/blog">Blog</a>
  <a href="/pricing">Pricing <b>new</b></a>
</nav>
`);
  });

  it('moves a JSX element before a self-closing sibling', async () => {
    const out = await run(JSX, 'Nav.tsx', [5, 7], [4, 7], Place.Before);

    expect(out.ok && out.change.after).toContain('    <nav>\n      <span>Pricing</span>\n      <Link to="/docs" />\n    </nav>');
  });

  it('refuses elements that are not siblings in the same parent', async () => {
    const out = await run(SVELTE, 'Nav.svelte', [3, 30], [2, 3], Place.Before);

    expect(out.ok).toBe(false);
  });

  it('refuses items rendered by an each block, and says so', async () => {
    const out = await run(EACH, 'List.svelte', [3, 5], [5, 3], Place.After);

    expect(out).toMatchObject({ ok: false, reason: expect.stringContaining('each') });
  });
});
