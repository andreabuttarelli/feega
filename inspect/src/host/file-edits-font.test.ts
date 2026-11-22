import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileEdits } from './file-edits';

const FILES: Record<string, string> = {
  'package.json': JSON.stringify({ devDependencies: { vite: '^5.0.0' } }),
  'src/app.css': "h1 { font-family: 'Brandon', sans-serif; }\n",
  'src/Card.svelte': '<p>x</p>\n<style>\n  p { font-family: Brandon, serif; }\n</style>\n',
  'tailwind.config.js': "export default { theme: { fontFamily: { sans: ['Brandon', 'ui-sans-serif'] } } }\n",
  'src/Untouched.svelte': '<p>y</p>\n',
  'node_modules/dep/index.css': "p { font-family: 'Brandon'; }\n"
};

function project(extra: Record<string, string> = {}, without: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), 'font-'));
  Object.entries({ ...FILES, ...extra }).filter(([path]) => !without.includes(path)).forEach(([path, text]) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  });
  return root;
}

const read = (root: string, path: string) => readFileSync(join(root, path), 'utf8');

describe('replacing a font everywhere', () => {
  it('rewrites the family in stylesheets, components and the Tailwind config', async () => {
    const root = project();
    const out = await fileEdits(root).replaceFont('Brandon', 'Inter', false);

    expect(out.ok).toBe(true);
    expect(read(root, 'src/app.css')).toBe("h1 { font-family: 'Inter', sans-serif; }\n");
    expect(read(root, 'src/Card.svelte')).toContain('font-family: Inter, serif');
    expect(read(root, 'tailwind.config.js')).toContain("sans: ['Inter', 'ui-sans-serif']");
  });

  it('leaves files that do not use the family and installed packages alone', async () => {
    const root = project();
    await fileEdits(root).replaceFont('Brandon', 'Inter', false);

    expect(read(root, 'src/Untouched.svelte')).toBe('<p>y</p>\n');
    expect(read(root, 'node_modules/dep/index.css')).toContain("'Brandon'");
  });

  it('is one step in the history and one undo brings every file back', async () => {
    const root = project();
    const edits = fileEdits(root);
    await edits.replaceFont('Brandon', 'Inter', false);

    expect(edits.history()).toHaveLength(1);
    expect(edits.history()[0].files.sort()).toEqual(['src/Card.svelte', 'src/app.css', 'tailwind.config.js']);

    await edits.undo();

    expect(read(root, 'src/app.css')).toBe(FILES['src/app.css']);
    expect(read(root, 'src/Card.svelte')).toBe(FILES['src/Card.svelte']);
    expect(read(root, 'tailwind.config.js')).toBe(FILES['tailwind.config.js']);
  });

  it('adds the Google Fonts import to the global stylesheet when the new font is a Google font', async () => {
    const root = project();
    await fileEdits(root).replaceFont('Brandon', 'Space Grotesk', true);

    expect(read(root, 'src/app.css')).toMatch(/^@import url\("https:\/\/fonts\.googleapis\.com\/css2\?family=Space\+Grotesk/);
  });

  it('links the font in the page head when there is no global stylesheet', async () => {
    const root = project({ 'index.html': '<html>\n<head>\n</head>\n<body></body>\n</html>\n' }, ['src/app.css']);
    await fileEdits(root).replaceFont('Brandon', 'Space Grotesk', true);

    expect(read(root, 'index.html')).toContain('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk');
  });

  it('adds no loading for a font the machine already has', async () => {
    const root = project();
    await fileEdits(root).replaceFont('Brandon', 'Helvetica', false);

    expect(read(root, 'src/app.css')).not.toContain('@import');
  });

  it('refuses when the family appears nowhere', async () => {
    const out = await fileEdits(project()).replaceFont('Nonexistent', 'Inter', false);

    expect(out).toEqual({ ok: false, reason: 'Nonexistent is not named in any source file' });
  });
});

describe('loading a font from Google Fonts', () => {
  it('adds the loading and leaves the family names as they are', async () => {
    const root = project();
    const out = await fileEdits(root).loadFont('Brandon');

    expect(out.ok).toBe(true);
    expect(read(root, 'src/app.css')).toMatch(/^@import url\("https:\/\/fonts\.googleapis\.com\/css2\?family=Brandon/);
    expect(read(root, 'src/Card.svelte')).toBe(FILES['src/Card.svelte']);
  });

  it('undoes in one step', async () => {
    const root = project();
    const edits = fileEdits(root);
    await edits.loadFont('Brandon');
    await edits.undo();

    expect(read(root, 'src/app.css')).toBe(FILES['src/app.css']);
  });
});
