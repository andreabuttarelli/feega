import { describe, expect, it } from 'vitest';
import { unpack } from '@feega/plugin-icon-kit/unpack';
import { indexData, version } from '../scripts/pack-icons';
import { PACKED, VERSION } from './packed.generated';
import { POPULAR, SOURCE, Style, fileOf, hasStyle, loadIcons } from './icons';

describe('heroicons index', () => {
  it('is the index of the installed heroicons package', async () => {
    expect(await unpack(PACKED)).toEqual(indexData());
  });

  it('names the exact version the icon files are fetched at', () => {
    expect(VERSION).toBe(version());
    expect(SOURCE).toEqual({ name: 'heroicons', version: VERSION });
  });

  it('lists every icon with the styles it exists in, and carries no drawing', async () => {
    const icons = await loadIcons();

    expect(icons.length).toBeGreaterThan(300);
    expect(icons.every((icon) => hasStyle(icon, Style.Outline) && hasStyle(icon, Style.Solid))).toBe(true);
    expect(icons.find((icon) => icon.name === 'arrow-small-down')?.styles).not.toContain(Style.Micro);
    expect(Object.keys(icons[0]).sort()).toEqual(['name', 'styles', 'words']);
  });

  it('only suggests icons that exist', async () => {
    const names = new Set((await loadIcons()).map((icon) => icon.name));

    expect(POPULAR.filter((name) => !names.has(name))).toEqual([]);
  });

  it('points at the file of each style in the package', () => {
    const camera = { name: 'camera', styles: [Style.Outline], words: [] };

    expect(fileOf(camera, Style.Outline)).toBe('24/outline/camera.svg');
    expect(fileOf(camera, Style.Mini)).toBe('20/solid/camera.svg');
  });
});
