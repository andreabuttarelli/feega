import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPIES } from './pixel-icons/targets.mjs';
import { PIXEL_PALETTE, PIXEL_ROWS, PixelIcon, pixelSvg } from './pixel-icons/src/pixel';

const HERE = join(fileURLToPath(new URL('.', import.meta.url)), 'pixel-icons');
const ROOT = join(HERE, '..', '..');
const EMPTY = '.';

describe('pixel-icons', () => {
  for (const { source, to } of COPIES) {
    it(`${to} matches packages/pixel-icons (run node --experimental-transform-types packages/pixel-icons/sync.mjs)`, () => {
      expect(readFileSync(join(ROOT, to), 'utf8')).toBe(readFileSync(join(HERE, source), 'utf8'));
    });
  }

  it('ogni icona ha righe della stessa larghezza e solo colori della palette', () => {
    for (const rows of Object.values(PIXEL_ROWS)) {
      expect(new Set(rows.map((row) => row.length)).size).toBe(1);
      for (const ch of new Set(rows.flatMap((row) => [...row]))) {
        expect(ch === EMPTY || ch in PIXEL_PALETTE).toBe(true);
      }
    }
  });

  it('pixelSvg disegna un rettangolo per cella piena', () => {
    const filled = PIXEL_ROWS[PixelIcon.Star].join('').replaceAll(EMPTY, '').length;

    expect(pixelSvg(PixelIcon.Star).match(/<rect /g)).toHaveLength(filled);
  });

  it('README e preview elencano ogni icona per nome', () => {
    const readme = readFileSync(join(HERE, 'README.md'), 'utf8');
    const preview = readFileSync(join(HERE, 'preview.html'), 'utf8');

    for (const name of Object.values(PixelIcon)) {
      expect(readme).toContain(`\`${name}\``);
      expect(preview).toContain(`<b>${name}</b>`);
    }
  });
});
