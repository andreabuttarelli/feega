import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NAV_ENTRIES, PANEL_WIDTHS } from '$lib/shell-nav';

const dir = dirname(fileURLToPath(import.meta.url));
const sheet = readFileSync(join(dir, 'CanvasSheet.svelte'), 'utf8');

describe('il foglio occupa la tela intera, non una colonna a sinistra', () => {
  it('nessun foglio ha una larghezza fissa in pixel', () => {
    const sheetIds = NAV_ENTRIES.filter((entry) => entry.family === 'sheet').map((entry) => entry.id);
    const sized = sheetIds.filter((id) => id in PANEL_WIDTHS);
    expect(sized).toEqual([]);
  });

  it('resta dentro lo stage della tela invece di finire nel body', () => {
    expect(sheet).toMatch(/portalProps=\{\{\s*disabled:\s*true\s*\}\}/);
  });

  it('si ancora a entrambi i bordi dello stage', () => {
    expect(sheet).toMatch(/right:\s*0\s*!important/);
    expect(sheet).not.toMatch(/--sheet-width/);
  });
});

describe('il foglio non copre la top bar e respira sul fondo', () => {
  it('parte sotto le scatole della top bar e lascia 8px dal fondo', () => {
    expect(sheet).toMatch(/top:\s*60px\s*!important/);
    expect(sheet).toMatch(/bottom:\s*8px\s*!important/);
  });
});

describe('il foglio vince sulle utility del primitivo, in qualunque ordine arrivino i CSS', () => {
  const primitive = readFileSync(join(dir, '../ui/sheet/sheet-content.svelte'), 'utf8');
  const SIDE_UTILITY_SPECIFICITY = 2;

  function specificity(selector: string): number {
    return (selector.match(/\[|\.|:(?!:)/g) ?? []).length;
  }

  it('il primitivo ancora il lato sinistro con utility data-[side], una classe più un attributo', () => {
    expect(primitive).toMatch(/data-\[side=left\]:left-0/);
    expect(primitive).toMatch(/data-\[side=left\]:sm:max-w-sm/);
  });

  it('ogni selettore di .canvas-sheet supera quella specificità, invece di pareggiarla', () => {
    const selectors = [...sheet.matchAll(/:global\(([^)]*canvas-sheet[^)]*)\)/g)].map((m) => m[1]);
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(specificity(selector), selector).toBeGreaterThan(SIDE_UTILITY_SPECIFICITY);
    }
  });
});
