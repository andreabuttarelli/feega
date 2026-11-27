import { describe, expect, it } from 'vitest';
import { PACKED } from './packed.generated';
import { unpack } from '@feega/plugin-icon-kit/unpack';
import { phosphorData } from '../scripts/pack-icons';
import { POPULAR, WEIGHTS, bodyOf, Weight, glyphOf, loadIcons } from './icons';

describe('phosphor icon data', () => {
  it('is the data of the installed @phosphor-icons/core package', async () => {
    expect(await unpack(PACKED)).toEqual(phosphorData());
  });

  it('holds the whole set with one drawing per weight', async () => {
    const icons = await loadIcons();

    expect(icons.length).toBeGreaterThan(1400);
    expect(icons.every((icon) => icon.bodies.length === WEIGHTS.length && icon.bodies.every((body) => body.startsWith('<')))).toBe(true);
  });

  it('draws each weight differently', async () => {
    const camera = (await loadIcons()).find((icon) => icon.name === 'camera')!;

    expect(new Set(WEIGHTS.map((weight) => bodyOf(camera, weight))).size).toBe(WEIGHTS.length);
    expect(glyphOf(camera, Weight.Bold)).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 256 256"/);
  });

  it('only suggests icons that exist', async () => {
    const names = new Set((await loadIcons()).map((icon) => icon.name));

    expect(POPULAR.filter((name) => !names.has(name))).toEqual([]);
  });
});
