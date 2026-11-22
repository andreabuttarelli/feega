import { describe, expect, it } from 'vitest';
import { replaceFamily, replaceEverywhere } from './font-replace';

const swap = (text: string) => replaceFamily(text, 'Brandon', 'Inter');

describe('replaceFamily in CSS', () => {
  it('rewrites a quoted family in a declaration and keeps the rest of the stack', () => {
    expect(swap("h1 { font-family: 'Brandon', sans-serif; }")).toBe("h1 { font-family: 'Inter', sans-serif; }");
  });

  it('rewrites an unquoted family and quotes a name with spaces', () => {
    expect(replaceFamily('p { font-family: Brandon, serif }', 'Brandon', 'Space Grotesk')).toBe("p { font-family: 'Space Grotesk', serif }");
  });

  it('rewrites a family in the font shorthand', () => {
    expect(swap('p { font: 16px/1.4 "Brandon", serif; }')).toBe('p { font: 16px/1.4 "Inter", serif; }');
  });

  it('rewrites a custom property holding a font stack', () => {
    expect(swap(':root { --font-sans: "Brandon", system-ui; }')).toBe(':root { --font-sans: "Inter", system-ui; }');
  });

  it('rewrites a Tailwind v4 theme font', () => {
    expect(swap('@theme { --font-display: "Brandon", sans-serif; }')).toBe('@theme { --font-display: "Inter", sans-serif; }');
  });

  it('leaves a family whose name only starts like the missing one', () => {
    expect(swap("p { font-family: 'Brandon Grotesque', serif; }")).toBe("p { font-family: 'Brandon Grotesque', serif; }");
  });

  it('leaves the @font-face that declares the family', () => {
    const face = "@font-face { font-family: 'Brandon'; src: url(b.woff2); }";

    expect(swap(face)).toBe(face);
  });

  it('rewrites a rule after an @font-face of the same family', () => {
    expect(swap("@font-face { font-family: 'Brandon'; }\nh1 { font-family: 'Brandon'; }")).toBe("@font-face { font-family: 'Brandon'; }\nh1 { font-family: 'Inter'; }");
  });

  it('leaves text that merely says the name', () => {
    expect(swap("<p>We use 'Brandon' everywhere</p>")).toBe("<p>We use 'Brandon' everywhere</p>");
  });
});

describe('replaceFamily in markup and scripts', () => {
  it('rewrites a style block of a component', () => {
    expect(swap('<h1>x</h1>\n<style>\n  h1 { font-family: Brandon, sans-serif; }\n</style>')).toContain('font-family: Inter, sans-serif');
  });

  it('rewrites an inline style attribute', () => {
    expect(swap('<p style="font-family: \'Brandon\', serif">x</p>')).toBe('<p style="font-family: \'Inter\', serif">x</p>');
  });

  it('rewrites a React style object', () => {
    expect(swap("<p style={{ fontFamily: 'Brandon, serif' }}>x</p>")).toBe("<p style={{ fontFamily: 'Inter, serif' }}>x</p>");
  });

  it('rewrites a Tailwind config font stack', () => {
    const config = "export default { theme: { extend: { fontFamily: { sans: ['Brandon', 'ui-sans-serif'], display: ['Brandon'] } } } }";

    expect(swap(config)).toBe("export default { theme: { extend: { fontFamily: { sans: ['Inter', 'ui-sans-serif'], display: ['Inter'] } } } }");
  });

  it('rewrites an arbitrary Tailwind font class, with underscores for spaces', () => {
    expect(replaceFamily('<h1 class="text-xl font-[\'Brandon_Grotesque\'] md:font-bold">', 'Brandon Grotesque', 'Space Grotesk')).toBe('<h1 class="text-xl font-[\'Space_Grotesk\'] md:font-bold">');
  });

  it('returns the same text when the family is not there', () => {
    expect(swap('p { font-family: serif; }')).toBe('p { font-family: serif; }');
  });
});

describe('replaceEverywhere', () => {
  it('returns one change per file that mentions the family', () => {
    const files = [
      { path: 'src/app.css', text: "h1 { font-family: 'Brandon'; }" },
      { path: 'src/Card.svelte', text: '<style>p { font-family: Brandon }</style>' },
      { path: 'src/other.css', text: 'p { color: red }' }
    ];

    expect(replaceEverywhere(files, 'Brandon', 'Inter').map((c) => c.path)).toEqual(['src/app.css', 'src/Card.svelte']);
  });

  it('carries the text before and after', () => {
    const [change] = replaceEverywhere([{ path: 'a.css', text: 'p { font-family: Brandon }' }], 'Brandon', 'Inter');

    expect(change).toEqual({ path: 'a.css', before: 'p { font-family: Brandon }', after: 'p { font-family: Inter }' });
  });
});

describe('replaceEverywhere removes the loading of the replaced family', () => {
  const url = (family: string) => `https://fonts.googleapis.com/css2?family=${family}:wght@300..800&display=swap`;

  it('drops the link of the family from a page head', () => {
    const html = `<head>\n  <link rel="stylesheet" href="${url('Brandon')}" />\n  <title>x</title>\n</head>\n`;
    const [change] = replaceEverywhere([{ path: 'index.html', text: html }], 'Brandon', 'Inter');

    expect(change.after).toBe('<head>\n  <title>x</title>\n</head>\n');
  });

  it('drops the @import of the family and keeps the rules', () => {
    const css = `@import url("${url('Brandon')}");\nh1 { font-family: Brandon; }\n`;
    const [change] = replaceEverywhere([{ path: 'a.css', text: css }], 'Brandon', 'Inter');

    expect(change.after).toBe('h1 { font-family: Inter; }\n');
  });

  it('matches a family with spaces written with a plus', () => {
    const css = `@import url("${url('Space+Grotesk')}");\n`;

    expect(replaceEverywhere([{ path: 'a.css', text: css }], 'Space Grotesk', 'Inter')[0].after).toBe('');
  });

  it('keeps the link of another family', () => {
    const html = `<link rel="stylesheet" href="${url('Lato')}" />`;

    expect(replaceEverywhere([{ path: 'index.html', text: html }], 'Brandon', 'Inter')).toEqual([]);
  });

  it('keeps a link that loads several families', () => {
    const html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Brandon&family=Lato" />';

    expect(replaceEverywhere([{ path: 'index.html', text: html }], 'Brandon', 'Inter')).toEqual([]);
  });
});
