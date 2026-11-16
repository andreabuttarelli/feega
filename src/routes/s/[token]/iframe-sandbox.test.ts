import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const page = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');
const iframeTags = [...page.matchAll(/<iframe[\s\S]*?><\/iframe>/g)].map((m) => m[0]);

describe('gli iframe del visore condiviso', () => {
  it('ce ne sono', () => {
    expect(iframeTags.length).toBeGreaterThan(0);
  });

  it('vengono tutti dalla stessa costante della tela', () => {
    for (const tag of iframeTags) {
      expect(tag).toMatch(/sandbox=\{IFRAME_SANDBOX\}/);
    }
  });

  it('nessuno concede allow-same-origin', () => {
    expect(page).not.toMatch(/sandbox="[^"]*allow-same-origin/);
  });
});
