import { describe, expect, it } from 'vitest';
import { unpack } from '@feega/plugin-icon-kit/unpack';
import { indexData, version } from '../scripts/pack-icons';
import { PACKED, VERSION } from './packed.generated';
import { POPULAR, SOURCE, Weight, fileOf, loadIcons } from './icons';

describe('phosphor icon index', () => {
  it('is the index of the installed @phosphor-icons/core package', async () => {
    expect(await unpack(PACKED)).toEqual(indexData());
  });

  it('names the exact version the icon files are fetched at', () => {
    expect(VERSION).toBe(version());
    expect(SOURCE).toEqual({ name: '@phosphor-icons/core', version: VERSION });
  });

  it('holds the whole set by name, and carries no drawing', async () => {
    const icons = await loadIcons();

    expect(icons.length).toBeGreaterThan(1400);
    expect(Object.keys(icons[0]).sort()).toEqual(['name', 'words']);
  });

  it('only suggests icons that exist', async () => {
    const names = new Set((await loadIcons()).map((icon) => icon.name));

    expect(POPULAR.filter((name) => !names.has(name))).toEqual([]);
  });

  it('points at the file of each weight, where regular has no suffix', () => {
    const camera = { name: 'camera', words: [] };

    expect(fileOf(camera, Weight.Regular)).toBe('assets/regular/camera.svg');
    expect(fileOf(camera, Weight.Bold)).toBe('assets/bold/camera-bold.svg');
  });
});
