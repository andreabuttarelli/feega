import { describe, expect, it } from 'vitest';
import fonts from '../inspect/src/webview/google-fonts.json';
import { parseMetadata } from './google-fonts.mjs';

const metadata = (list: object[], prefix = '') => prefix + JSON.stringify({ axisRegistry: [], familyMetadataList: list });

describe('parseMetadata', () => {
  it('lists family and category, most popular first', () => {
    const text = metadata([
      { family: 'Rare', category: 'Serif', popularity: 900 },
      { family: 'Inter', category: 'Sans Serif', popularity: 3 }
    ]);

    expect(parseMetadata(text)).toEqual([
      ['Inter', 'sans-serif'],
      ['Rare', 'serif']
    ]);
  });

  it('reads the response behind its anti-XSSI prefix', () => {
    expect(parseMetadata(metadata([{ family: 'Inter', category: 'Sans Serif', popularity: 1 }], ")]}'\n"))).toHaveLength(1);
  });

  it('drops a category it does not know', () => {
    expect(parseMetadata(metadata([{ family: 'Odd', category: 'Symbols', popularity: 1 }]))).toEqual([]);
  });
});

describe('the committed list', () => {
  it('holds the Google Fonts catalogue', () => {
    expect(fonts.length).toBeGreaterThan(1500);
    expect(fonts).toContainEqual(['Inter', 'sans-serif']);
    expect(fonts).toContainEqual(['JetBrains Mono', 'monospace']);
  });
});
