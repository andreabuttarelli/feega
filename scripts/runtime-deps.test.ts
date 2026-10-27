import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('dipendenze usate dal server a runtime', () => {
  it('typescript è una dependency: adapter-node inlinea le devDependencies e il suo __filename rompe il server ESM', () => {
    expect(pkg.dependencies).toHaveProperty('typescript');
    expect(pkg.devDependencies ?? {}).not.toHaveProperty('typescript');
  });
});
