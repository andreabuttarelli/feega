import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { paletteOf } from './runtime.js';

const page = `<head><style>
  :root { --color-brand: #0078d4; --ink: rgb(17, 17, 17); --space: 8px; }
  .a { color: rgb(17, 17, 17); }
  .b { background-color: #ffcc00; }
</style></head>
<body data-feega-src="p.svelte:1:1">
  <p class="a" data-feega-src="p.svelte:2:1">x</p>
  <p class="a" data-feega-src="p.svelte:3:1">y</p>
  <div class="b" data-feega-src="p.svelte:4:1">z</div>
</body>`;

describe('paletteOf', () => {
  it('lists page colours once each, most used first, transparent left out', () => {
    const { document } = paletteOf(new JSDOM(page).window.document);

    expect(document[0]).toBe('rgb(17, 17, 17)');
    expect(document).toContain('rgb(255, 204, 0)');
    expect(new Set(document).size).toBe(document.length);
    expect(document.some((c: string) => c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c))).toBe(false);
  });

  it('lists the colour custom properties of :root as named tokens, not other variables', () => {
    const { tokens } = paletteOf(new JSDOM(page).window.document);

    expect(tokens).toEqual([
      { name: '--color-brand', value: '#0078d4' },
      { name: '--ink', value: 'rgb(17, 17, 17)' }
    ]);
  });
});
