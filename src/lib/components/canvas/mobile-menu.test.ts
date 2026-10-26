import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

describe('su mobile il menu non offre le scorciatoie da tastiera', () => {
  it('la voce shortcuts è solo desktop', () => {
    const menu = read('./CanvasMenu.svelte');
    expect(menu).toMatch(/id: 'shortcuts'[^}]*desktopOnly: true/);
    expect(menu).toMatch(/navigation === 'page' && item\.desktopOnly/);
  });
});
