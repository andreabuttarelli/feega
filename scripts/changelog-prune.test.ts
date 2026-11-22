import { describe, expect, it } from 'vitest';
import { CHANGELOG_DIR, bundleEntries } from './changelog-entries';
import { MAX_ENTRIES, MAX_LINE_LENGTH, entryNames } from './changelog-prune.mjs';

const ONE_LINE = 1;

async function entries(): Promise<{ items: string[] }[]> {
  const { code } = await bundleEntries(CHANGELOG_DIR);
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return (await import(/* @vite-ignore */ url)).default;
}

describe('changelog size', () => {
  it('al più MAX_ENTRIES file di entry', () => {
    expect(entryNames(CHANGELOG_DIR).length).toBeLessThanOrEqual(MAX_ENTRIES);
  });

  it('ogni entry è una riga sola di al più MAX_LINE_LENGTH caratteri', async () => {
    for (const entry of await entries()) {
      expect(entry.items).toHaveLength(ONE_LINE);
      expect(entry.items[0].length).toBeLessThanOrEqual(MAX_LINE_LENGTH);
    }
  });
});
