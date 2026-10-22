import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHANGELOG_DIR, bundleEntries, entryFiles } from './changelog-entries';

const ISO_DATE_LENGTH = 10;

async function evaluated(code: string): Promise<{ date: string }[]> {
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return (await import(/* @vite-ignore */ url)).default;
}

describe('changelog entries bundle', () => {
  it('le entry escono dal file più recente al più vecchio, come i nomi file', async () => {
    const { code } = await bundleEntries(CHANGELOG_DIR);
    const entries = await evaluated(code);

    const fileDates = entryFiles(CHANGELOG_DIR).map((f) => basename(f).slice(0, ISO_DATE_LENGTH));
    expect(entries.map((e) => e.date)).toEqual(fileDates);
  });

  it('un file di test non entra nel bundle', () => {
    expect(entryFiles(CHANGELOG_DIR).filter((f) => f.endsWith('.test.ts'))).toEqual([]);
  });
});
