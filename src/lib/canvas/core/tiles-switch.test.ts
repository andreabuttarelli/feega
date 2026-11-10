import { describe, expect, it } from 'vitest';
import { TILES_BY_DEFAULT, tilesOn } from './tiles-switch';

describe('the tiled renderer switch', () => {
  it('follows the default when nothing asks otherwise', () => {
    expect(tilesOn('', null)).toBe(TILES_BY_DEFAULT);
  });

  it('turns off with ?coreTiles=0 or a stored 0, the URL winning', () => {
    expect(tilesOn('?coreTiles=0', null)).toBe(false);
    expect(tilesOn('', '0')).toBe(false);
    expect(tilesOn('?coreTiles', '0')).toBe(true);
    expect(tilesOn('?coreTiles=1', null)).toBe(true);
  });
});
