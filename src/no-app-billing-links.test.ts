import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { billingPath } from '$lib/billing-path';

const SRC = fileURLToPath(new URL('.', import.meta.url));
const SOURCE = /\.(ts|svelte)$/;
const DEAD_BILLING = '/app/billing';
const HISTORY = join('lib', 'content', 'changelog');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sources(path);
    }
    return SOURCE.test(entry.name) && !entry.name.includes('.test.') ? [path] : [];
  });
}

describe('il billing vive nelle impostazioni del progetto', () => {
  it('il percorso è quello del progetto', () => {
    expect(billingPath('p1')).toBe('/p/p1/settings/billing');
  });

  it('la pagina a cui porta esiste su disco', () => {
    expect(existsSync(join(SRC, 'routes', 'p', '[projectId]', 'settings', 'billing', '+page.server.ts'))).toBe(true);
  });

  it('nessun link punta a /app/billing, che non esiste più', () => {
    const offenders = sources(SRC)
      .filter((file) => !file.includes(HISTORY))
      .filter((file) => readFileSync(file, 'utf8').includes(DEAD_BILLING));

    expect(offenders.map((f) => f.slice(SRC.length))).toEqual([]);
  });
});
