import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, dirsFor } from './targets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

for (const source of SOURCES) {
  for (const dir of dirsFor(source)) {
    mkdirSync(join(ROOT, dir), { recursive: true });
    copyFileSync(join(HERE, source), join(ROOT, dir, source));
  }
}
