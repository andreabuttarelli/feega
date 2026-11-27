import { describe, expect, it } from 'vitest';
import { PACKED } from './packed.generated';
import { unpack } from '@feega/plugin-icon-kit/unpack';
import { heroiconsData } from '../scripts/pack-icons';
import { POPULAR, STYLES, Style, loadIcons } from './icons';

describe('heroicons data', () => {
  it('is the data of the installed heroicons package', async () => {
    expect(await unpack(PACKED)).toEqual(heroiconsData());
  });

  it('holds every icon in outline and solid, with a drawing per style or none', async () => {
    const icons = await loadIcons();

    expect(icons.length).toBeGreaterThan(300);
    expect(icons.every((icon) => icon.bodies[STYLES.indexOf(Style.Outline)].startsWith('<') && icon.bodies[STYLES.indexOf(Style.Solid)].startsWith('<'))).toBe(true);
    expect(icons.every((icon) => icon.bodies.length === STYLES.length)).toBe(true);
  });

  it('only suggests icons that exist', async () => {
    const names = new Set((await loadIcons()).map((icon) => icon.name));

    expect(POPULAR.filter((name) => !names.has(name))).toEqual([]);
  });
});
