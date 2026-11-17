import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOC_ENTRY, docStamp } from './motion-doc-stamp';

function parserIn(dir: string, fallback: string, unrelated = '') {
  writeFileSync(join(dir, 'defaults.ts'), `export const FPS = ${fallback};\n`);
  writeFileSync(join(dir, 'doc.ts'), `import { FPS } from './defaults';\nexport const parseMotionDoc = (d: { fps?: number }) => ({ ...d, fps: d.fps ?? FPS });\nexport const ${unrelated || 'other'} = () => 1;\n`);
  return join(dir, 'doc.ts');
}

describe('the stamp of the stored doc reader', () => {
  it('is the same for the same sources', async () => {
    const first = await docStamp(DOC_ENTRY);

    expect(first.stamp).toMatch(/^[0-9a-f]{16}$/);
    expect((await docStamp(DOC_ENTRY)).stamp).toBe(first.stamp);
  });

  it('changes when a default the parser imports changes', async () => {
    const entry = parserIn(mkdtempSync(join(tmpdir(), 'stamp-')), '30');
    const before = await docStamp(entry);
    parserIn(join(entry, '..'), '60');

    expect((await docStamp(entry)).stamp).not.toBe(before.stamp);
  });

  it('ignores code the parser never reaches', async () => {
    const entry = parserIn(mkdtempSync(join(tmpdir(), 'stamp-')), '30', 'other');
    const before = await docStamp(entry);
    parserIn(join(entry, '..'), '30', 'renamed');

    expect((await docStamp(entry)).stamp).toBe(before.stamp);
  });

  it('lists every source the parser reads, so a dev server can watch them', async () => {
    const { inputs } = await docStamp(DOC_ENTRY);

    expect(inputs.some((f) => f.endsWith('packages/motion-core/src/motion/doc.ts'))).toBe(true);
    expect(inputs.some((f) => f.includes('node_modules/zod'))).toBe(true);
  });
});
