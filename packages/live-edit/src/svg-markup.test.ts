import { describe, expect, it } from 'vitest';
import { svgMarkup } from './svg-markup';

const MARKUP = '<svg viewBox="0 0 24 24" stroke-width="2" class="icon"><path d="M1 1"/></svg>';
const OLD = '<svg viewBox="0 0 10 10"><path d="M0 0"/></svg>';

const files = (map: Record<string, string>) => async (path: string) => map[path] ?? null;

const SVELTE_INLINE = `<a class="btn">
  ${OLD}
  Mac
</a>
`;

const SVELTE_HTML = `<script>
  import { APPLE } from './icons';
</script>

<a class="mac">{@html APPLE}Mac app</a>
`;

const ICONS = `export const GITHUB = '<svg></svg>';

export const APPLE = '${OLD}';
`;

describe('svgMarkup', () => {
  it('replaces an inline svg in place', async () => {
    const out = await svgMarkup(files({ 'src/A.svelte': SVELTE_INLINE }), { file: 'src/A.svelte', line: 2, col: 3 }, MARKUP);

    expect(out.ok && out.changes[0].after).toBe(SVELTE_INLINE.replace(OLD, MARKUP));
  });

  it('turns attributes into jsx in a react file', async () => {
    const react = 'export const A = () => <svg viewBox="0 0 1 1"></svg>;\n';
    const out = await svgMarkup(files({ 'src/A.tsx': react }), { file: 'src/A.tsx', line: 1, col: 24 }, MARKUP);

    expect(out.ok && out.changes[0].after).toContain('<svg viewBox="0 0 24 24" strokeWidth="2" className="icon">');
  });

  it('writes an html constant, not the element', async () => {
    const out = await svgMarkup(files({ 'src/A.svelte': SVELTE_HTML, 'src/icons.ts': ICONS }), { file: 'src/A.svelte', line: 5, col: 1 }, MARKUP, 'svg');

    expect(out.ok && out.changes[0].path).toBe('src/icons.ts');
    expect(out.ok && out.changes[0].after).toBe(ICONS.replace(`'${OLD}'`, `\`${MARKUP}\``));
  });

  it('writes an imported svg file', async () => {
    const page = `<script>\n  import mac from './mac.svg?raw';\n</script>\n<a>{@html mac}</a>\n`;
    const out = await svgMarkup(files({ 'src/A.svelte': page, 'src/mac.svg': '<svg></svg>' }), { file: 'src/A.svelte', line: 4, col: 1 }, MARKUP, 'svg');

    expect(out.ok && out.changes[0]).toEqual({ path: 'src/mac.svg', before: '<svg></svg>', after: MARKUP });
  });

  it('refuses markup that comes from a computed expression', async () => {
    const page = '<a>{@html render(icon)}</a>\n';
    const out = await svgMarkup(files({ 'src/A.svelte': page }), { file: 'src/A.svelte', line: 1, col: 1 }, MARKUP, 'svg');

    expect(out.ok).toBe(false);
  });
});
