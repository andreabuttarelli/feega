import { describe, expect, it } from 'vitest';
import { orgFontCss } from './org-fonts';

describe('orgFontCss', () => {
  it('declares one face per file with its weight and style', () => {
    const css = orgFontCss([
      { assetId: 'a', family: 'Acme', weight: 400, italic: false, url: 'https://s/a.woff2' },
      { assetId: 'b', family: 'Acme', weight: 700, italic: true, url: 'https://s/b.woff2' }
    ]);

    expect(css).toContain('font-family:"Acme";src:url("https://s/a.woff2");font-weight:400;font-style:normal');
    expect(css).toContain('font-weight:700;font-style:italic');
  });

  it('skips a file without a url and quotes a family with an apostrophe', () => {
    const css = orgFontCss([
      { assetId: 'a', family: "O'Hara", weight: 400, italic: false, url: 'https://s/a.woff2' },
      { assetId: 'b', family: 'Gone', weight: 400, italic: false, url: null }
    ]);

    expect(css).toContain(`font-family:"O'Hara"`);
    expect(css).not.toContain('Gone');
  });
});
