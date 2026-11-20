import { describe, expect, it } from 'vitest';
import { GLOBAL_SHEETS, globalSheetOf, googleFontImport, googleFontLink } from './font-wiring';

const files = (all: Record<string, string>) => async (path: string) => all[path] ?? null;

describe('globalSheetOf', () => {
  it('finds the first global stylesheet the project has', async () => {
    expect(await globalSheetOf(files({ 'app/globals.css': '@import "tailwindcss";' }))).toBe('app/globals.css');
    expect(await globalSheetOf(files({ 'src/app.css': ':root {}' }))).toBe('src/app.css');
    expect(await globalSheetOf(files({}))).toBeNull();
  });

  it('otherwise follows the stylesheet the root layout or entry imports', async () => {
    const read = files({ 'src/routes/+layout.svelte': "<script>\n  import '$lib/site/site.css';\n</script>", 'src/lib/site/site.css': ':root {}' });

    expect(await globalSheetOf(read)).toBe('src/lib/site/site.css');
  });

  it('knows the usual places for every framework', () => {
    expect(GLOBAL_SHEETS).toEqual(expect.arrayContaining(['src/app.css', 'src/index.css', 'app/globals.css', 'src/styles/global.css']));
  });
});

describe('googleFontImport', () => {
  it('adds the Google Fonts import at the very top, before Tailwind', async () => {
    const out = await googleFontImport(files({ 'src/app.css': '@import "tailwindcss";\n' }), 'src/app.css', 'Space Grotesk');

    expect(out?.after).toBe('@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..800&display=swap");\n@import "tailwindcss";\n');
  });

  it('a font already imported is not added twice', async () => {
    const css = '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300..800&display=swap");\n';

    expect(await googleFontImport(files({ 'src/app.css': css }), 'src/app.css', 'Inter')).toBeNull();
  });
});

describe('googleFontLink', () => {
  const link = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..800&display=swap" />';

  it('a Vite or Vue app gets the link in the head of index.html', async () => {
    const html = '<html>\n<head><meta charset="utf-8"></head>\n<body></body>\n</html>\n';
    const out = await googleFontLink(files({ 'index.html': html }), 'Space Grotesk');

    expect(out).toEqual({ path: 'index.html', before: html, after: html.replace('</head>', `  ${link}\n</head>`) });
  });

  it('SvelteKit gets the link in the head of app.html', async () => {
    const html = '<head>\n  %sveltekit.head%\n</head>\n';
    const out = await googleFontLink(files({ 'src/app.html': html }), 'Space Grotesk');

    expect(out?.after).toContain(link);
    expect(out?.path).toBe('src/app.html');
  });

  it('a Next app gets a head with the link inside the html of the root layout', async () => {
    const layout = 'export default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}\n';
    const out = await googleFontLink(files({ 'app/layout.jsx': layout }), 'Space Grotesk');

    expect(out?.after).toContain(`<html lang="en">\n      <head>\n        ${link}\n      </head>`);
  });

  it('a font already linked is not added twice', async () => {
    const html = `<head>${link}</head>`;

    expect(await googleFontLink(files({ 'index.html': html }), 'Space Grotesk')).toBeNull();
  });

  it('a project with no page shell gets nothing', async () => {
    expect(await googleFontLink(files({}), 'Space Grotesk')).toBeNull();
  });
});
