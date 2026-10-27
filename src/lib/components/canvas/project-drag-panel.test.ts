import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const panel = readFileSync(fileURLToPath(new URL('./BrandsPanel.svelte', import.meta.url)), 'utf8');

describe('il pannello brand offre sempre di crearne uno', () => {
  it('ha un link al wizard che riporta alla tela', () => {
    expect(panel).toMatch(/brands\/new\?returnTo=/);
  });

  it('il vuoto dei brand non parla di generare o caricare', () => {
    expect(readFileSync(fileURLToPath(new URL('./BrandSwitcher.svelte', import.meta.url)), 'utf8')).toMatch(/No brands yet/);
  });
});
