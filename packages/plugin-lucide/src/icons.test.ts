import { describe, expect, it } from 'vitest';
import { unpack } from '@feega/plugin-icon-kit/unpack';
import { indexData, version } from '../scripts/pack-icons';
import { PACKED, VERSION } from './packed.generated';
import { POPULAR, SOURCE, fileOf, loadIcons } from './icons';

describe('lucide icon index', () => {
  it('is the index of the installed lucide-static package', async () => {
    expect(await unpack(PACKED)).toEqual(indexData());
  });

  it('names the exact version the icon files are fetched at', () => {
    expect(VERSION).toBe(version());
    expect(SOURCE).toEqual({ name: 'lucide-static', version: VERSION });
  });

  it('holds the whole set by name, and carries no drawing', async () => {
    const icons = await loadIcons();

    expect(icons.length).toBeGreaterThan(1500);
    expect(Object.keys(icons[0]).sort()).toEqual(['name', 'words']);
  });

  it('keeps the search words of an icon', async () => {
    const camera = (await loadIcons()).find((icon) => icon.name === 'camera');

    expect(camera?.words.length).toBeGreaterThan(0);
  });

  it('only suggests icons that exist', async () => {
    const names = new Set((await loadIcons()).map((icon) => icon.name));

    expect(POPULAR.filter((name) => !names.has(name))).toEqual([]);
  });

  it('points at the svg file of the icon in the package', async () => {
    const [first] = await loadIcons();

    expect(fileOf(first)).toBe(`icons/${first.name}.svg`);
  });
});
