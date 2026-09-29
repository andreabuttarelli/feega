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
