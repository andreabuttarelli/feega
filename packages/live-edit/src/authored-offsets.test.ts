import { describe, expect, it } from 'vitest';
import { OffsetSide, authoredOffsets, offsetSidesOfClasses } from './authored-offsets';

const files = (map: Record<string, string>) => async (path: string) => map[path] ?? null;

const at = (file: string, line: number, col: number) => ({ file, line, col });

describe('offsetSidesOfClasses', () => {
  it('reads Tailwind tokens, negative ones and inset shorthands included', () => {
    expect(offsetSidesOfClasses('absolute top-3 -left-2 inset-x-0')).toEqual([OffsetSide.Top, OffsetSide.Right, OffsetSide.Left]);
  });

  it('inset sets all four sides', () => {
    expect(offsetSidesOfClasses('inset-0')).toEqual([OffsetSide.Top, OffsetSide.Right, OffsetSide.Bottom, OffsetSide.Left]);
  });

  it('ignores variants and unrelated classes', () => {
    expect(offsetSidesOfClasses('md:top-3 text-top flex')).toEqual([]);
  });
});

describe('authoredOffsets', () => {
  it('finds a side in a scoped Svelte rule', async () => {
    const page = '<div class="badge">New</div>\n\n<style>\n  .badge {\n    position: absolute;\n    top: 12px;\n  }\n</style>\n';

    expect(await authoredOffsets(files({ 'a.svelte': page }), at('a.svelte', 1, 1))).toEqual([OffsetSide.Top]);
  });

  it('finds sides in the CSS module a JSX element uses', async () => {
    const jsx = "import styles from './A.module.css';\n\nexport const A = () => (\n  <span className={styles.badge}>New</span>\n);\n";
    const css = '.other { top: 1px; }\n\n.badge {\n  position: absolute;\n  top: 12px;\n  left: 0;\n}\n';

    expect(await authoredOffsets(files({ 'A.jsx': jsx, 'A.module.css': css }), at('A.jsx', 4, 3))).toEqual([OffsetSide.Top, OffsetSide.Left]);
  });

  it('finds sides from several module classes joined in a template', async () => {
    const jsx = "import styles from './A.module.css';\n\nexport const A = () => (\n  <span className={`${styles.base} ${styles.badge}`}>New</span>\n);\n";
    const css = '.base { position: absolute; }\n.badge { right: 8px; }\n';

    expect(await authoredOffsets(files({ 'A.jsx': jsx, 'A.module.css': css }), at('A.jsx', 4, 3))).toEqual([OffsetSide.Right]);
  });

  it('finds sides in an imported plain stylesheet', async () => {
    const jsx = "import './a.css';\n\nexport const A = () => (\n  <span className=\"badge\">New</span>\n);\n";
    const css = '.badge {\n  inset: 0;\n}\n';

    expect(await authoredOffsets(files({ 'A.jsx': jsx, 'a.css': css }), at('A.jsx', 4, 3))).toEqual([OffsetSide.Top, OffsetSide.Right, OffsetSide.Bottom, OffsetSide.Left]);
  });

  it('finds Tailwind tokens in the element', async () => {
    const jsx = 'export const A = () => (\n  <span className="absolute top-3 right-4">New</span>\n);\n';

    expect(await authoredOffsets(files({ 'A.jsx': jsx }), at('A.jsx', 2, 3))).toEqual([OffsetSide.Top, OffsetSide.Right]);
  });

  it('finds sides in an inline style', async () => {
    const page = '<div style="position: absolute; bottom: 4px">New</div>\n';

    expect(await authoredOffsets(files({ 'a.svelte': page }), at('a.svelte', 1, 1))).toEqual([OffsetSide.Bottom]);
  });

  it('does not count auto, descendant rules or other elements', async () => {
    const page = '<div class="badge">New</div>\n\n<style>\n  .badge { top: auto; }\n  .page .badge { left: 4px; }\n  .badge:hover { right: 4px; }\n</style>\n';

    expect(await authoredOffsets(files({ 'a.svelte': page }), at('a.svelte', 1, 1))).toEqual([]);
  });
});
