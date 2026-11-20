import { describe, expect, it } from 'vitest';
import { detectLibrary } from './icon-library';
import { swapIcon } from './icon-swap';

const FILE = 'src/Nav.svelte';
const SVELTE = `<script>
  import Heart from '@lucide/svelte/icons/heart';
</script>

<button><Heart size={16} class="icon" /></button>
`;

const REACT = `import { Heart, Star } from 'lucide-react';

export const Nav = () => (
  <nav>
    <Heart size={16} />
    <Star />
  </nav>
);
`;

const REACT_TWICE = `import { Heart } from 'lucide-react';

export const Nav = () => (
  <nav>
    <Heart />
    <Heart />
  </nav>
);
`;

const lucideSvelte = detectLibrary(JSON.stringify({ dependencies: { '@lucide/svelte': '^0.5.0' } }))!;
const lucideReact = detectLibrary(JSON.stringify({ dependencies: { 'lucide-react': '^0.400.0' } }))!;

describe('swapIcon', () => {
  it('swaps a lucide svelte component and its import path', async () => {
    const out = await swapIcon(async () => SVELTE, { file: FILE, line: 5, col: 9 }, 'mail', lucideSvelte);

    expect(out.ok && out.change.after).toBe(SVELTE.replace(/Heart/g, 'Mail').replace('icons/heart', 'icons/mail'));
  });

  it('swaps a lucide react named import and keeps the others', async () => {
    const out = await swapIcon(async () => REACT, { file: 'src/Nav.tsx', line: 5, col: 5 }, 'arrow-right', lucideReact);

    expect(out.ok && out.change.after).toBe(REACT.replace('{ Heart, Star }', '{ ArrowRight, Star }').replace('<Heart size', '<ArrowRight size'));
  });

  it('keeps the old import while another element still uses it', async () => {
    const out = await swapIcon(async () => REACT_TWICE, { file: 'src/Nav.tsx', line: 5, col: 5 }, 'mail', lucideReact);

    expect(out.ok && out.change.after).toContain("import { Heart, Mail } from 'lucide-react';");
    expect(out.ok && out.change.after).toContain('<Mail />\n    <Heart />');
  });

  it('refuses an element that is not an icon of the library', async () => {
    const out = await swapIcon(async () => SVELTE, { file: FILE, line: 5, col: 1 }, 'mail', lucideSvelte);

    expect(out.ok).toBe(false);
  });

  it('detects nothing without an icon package', () => {
    expect(detectLibrary(JSON.stringify({ dependencies: { react: '1' } }))).toBeNull();
  });
});
