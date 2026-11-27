import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import bridgeFiles from './bridge-files.json';

const SOURCE_DIR = join(__dirname, '../../../packages/source-map/src');
const RELATIVE_IMPORT = /from\s+['"]\.\/([\w.-]+\.js)['"]/g;

const importsOf = (file: string): string[] => [...readFileSync(join(SOURCE_DIR, file), 'utf8').matchAll(RELATIVE_IMPORT)].map((m) => m[1]);

describe('bridge files', () => {
  it('ogni modulo importato dal bridge viene copiato nel progetto', () => {
    const missing = bridgeFiles.filter((f) => existsSync(join(SOURCE_DIR, f))).flatMap(importsOf).filter((f) => !bridgeFiles.includes(f));

    expect([...new Set(missing)]).toEqual([]);
  });
});
