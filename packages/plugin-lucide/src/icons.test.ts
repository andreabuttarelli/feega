import { describe, expect, it } from 'vitest';
import { PACKED } from './packed.generated';
import { unpack } from '@feega/plugin-icon-kit/unpack';
import { iconsData } from '../scripts/pack-icons';
import { POPULAR, glyphOf, loadIcons } from './icons';

describe('lucide icon data', () => {
  it('is the data of the installed lucide-static package', async () => {
    expect(await unpack(PACKED)).toEqual(iconsData());
  });

  it('holds the whole set, each icon with drawing markup', async () => {
    const icons = await loadIcons();

    expect(icons.length).toBeGreaterThan(1500);
    expect(icons.every((icon) => icon.body.startsWith('<'))).toBe(true);
  });

  it('keeps the search words of an icon', async () => {
    const camera = (await loadIcons()).find((icon) => icon.name === 'camera');

    expect(camera?.words.length).toBeGreaterThan(0);
  });

  it('only suggests icons that exist', async () => {
    const names = new Set((await loadIcons()).map((icon) => icon.name));

    expect(POPULAR.filter((name) => !names.has(name))).toEqual([]);
  });

  it('draws a glyph as a standalone svg', async () => {
    const [first] = await loadIcons();

    expect(glyphOf(first.body)).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"/);
  });
});
