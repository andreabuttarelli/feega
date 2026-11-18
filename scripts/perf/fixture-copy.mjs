import { chmodSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export function fixtureCopy(source) {
  const file = join(mkdtempSync(join(tmpdir(), 'feega-load-')), 'served.feega');
  copyFileSync(source, file);
  chmodSync(file, 0o644);
  return { file, dispose: () => rmSync(dirname(file), { recursive: true, force: true }) };
}
