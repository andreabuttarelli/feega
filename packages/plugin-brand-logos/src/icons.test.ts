import { describe, expect, it } from 'vitest';
import { unpack } from '@feega/plugin-icon-kit/unpack';
import { indexData, version } from '../scripts/pack-icons';
import { PACKED, VERSION } from './packed.generated';
import { POPULAR, SOURCE, fileOf, loadLogos } from './icons';

describe('brand logo index', () => {
  it('is the index of the installed simple-icons package', async () => {
    expect(await unpack(PACKED)).toEqual(indexData());
  });

  it('names the exact version the logo files are fetched at', () => {
    expect(VERSION).toBe(version());
    expect(SOURCE).toEqual({ name: 'simple-icons', version: VERSION });
  });

  it('holds thousands of brands, each with a title and a hex colour, and no drawing', async () => {
    const logos = await loadLogos();

    expect(logos.length).toBeGreaterThan(3000);
    expect(logos.every((logo) => /^[0-9A-Fa-f]{6}$/.test(logo.hex) && logo.title.length > 0)).toBe(true);
    expect(Object.keys(logos[0]).sort()).toEqual(['hex', 'name', 'title', 'words']);
  });

  it('only suggests brands that exist', async () => {
    const names = new Set((await loadLogos()).map((logo) => logo.name));

    expect(POPULAR.filter((name) => !names.has(name))).toEqual([]);
  });

  it('points at the svg file of the brand in the package', async () => {
    const github = (await loadLogos()).find((logo) => logo.name === 'github')!;

    expect(fileOf(github)).toBe('icons/github.svg');
  });
});
