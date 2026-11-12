import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url);
const appHtml = readFileSync(new URL('src/app.html', ROOT), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('static/site.webmanifest', ROOT), 'utf8'));
const PNG_WIDTH_OFFSET = 16;

const pngSize = (path: string) => {
  const bytes = readFileSync(new URL(path, ROOT));
  return [bytes.readUInt32BE(PNG_WIDTH_OFFSET), bytes.readUInt32BE(PNG_WIDTH_OFFSET + 4)].join('x');
};

describe('app icons', () => {
  it('every icon the page links exists in static', () => {
    const hrefs = [...appHtml.matchAll(/rel="(?:icon|apple-touch-icon)" href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(expect.arrayContaining(['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png']));
    for (const href of hrefs) {
      expect(existsSync(new URL(`static${href}`, ROOT)), href).toBe(true);
    }
  });

  it('every manifest icon has the size it declares', () => {
    for (const { src, sizes } of manifest.icons) {
      expect(pngSize(`static${src}`), src).toBe(sizes);
    }
  });

  it('apple touch icon is 180 square', () => {
    expect(pngSize('static/apple-touch-icon.png')).toBe('180x180');
  });
});
