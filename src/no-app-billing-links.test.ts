import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BILLING_PATH } from '$lib/billing-path';

const SRC = fileURLToPath(new URL('.', import.meta.url));
const SOURCE = /\.(ts|svelte)$/;
const DEAD_LINKS = ['/app/billing', '/settings/billing', '}/credits'];
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

describe('i crediti vivono nel workspace, non nel progetto', () => {
  it('il percorso non porta né progetto né brand', () => {
    expect(BILLING_PATH).toBe('/app/credits');
  });

  it('la pagina a cui porta esiste su disco', () => {
    expect(existsSync(join(SRC, 'routes', 'app', 'credits', '+page.server.ts'))).toBe(true);
  });

  it('nessun link punta a un vecchio indirizzo dei crediti', () => {
    const offenders = sources(SRC)
      .filter((file) => !file.includes(HISTORY))
      .filter((file) => DEAD_LINKS.some((link) => readFileSync(file, 'utf8').includes(link)));

    expect(offenders.map((f) => f.slice(SRC.length))).toEqual([]);
  });
});
