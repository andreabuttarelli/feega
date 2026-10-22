import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = 'src';
const SOURCE_FILE = /\.(ts|js|svelte)$/;
const LUCIDE_BARREL_IMPORT = /from\s+['"]@lucide\/svelte['"]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return SOURCE_FILE.test(entry.name) ? [path] : [];
  });
}

describe('lucide imports', () => {
  it('nessun file importa il barrel di @lucide/svelte: ogni icona va importata da icons/<nome>', () => {
    const offenders = sourceFiles(SOURCE_ROOT).filter((file) =>
      LUCIDE_BARREL_IMPORT.test(readFileSync(file, 'utf8'))
    );

    expect(offenders).toEqual([]);
  });
});
