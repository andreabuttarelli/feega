import { describe, expect, it } from 'vitest';
import { search, type Searchable } from './search';

const ICONS: Searchable[] = [
  { name: 'camera', words: ['photo', 'picture'] },
  { name: 'camera-off', words: ['photo'] },
  { name: 'video', words: ['camera', 'film'] },
  { name: 'image', words: ['picture', 'photo'] },
  { name: 'scan-camera', words: [] },
  { name: 'sun', words: ['weather'] }
];

const names = (query: string, limit = 10) => search(ICONS, query, limit).map((icon) => icon.name);

describe('search', () => {
  it('puts an exact name first, then names that start with the query, then names that contain it, then words', () => {
    expect(names('camera')).toEqual(['camera', 'camera-off', 'scan-camera', 'video']);
  });

  it('finds an icon by one of its words', () => {
    expect(names('weather')).toEqual(['sun']);
  });

  it('ignores case, surrounding spaces and dashes versus spaces', () => {
    expect(names('  Camera Off ')).toEqual(['camera-off']);
  });

  it('needs every word of the query', () => {
    expect(names('photo picture')).toEqual(['camera', 'image']);
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(names('zzz')).toEqual([]);
  });

  it('cuts the list at the limit', () => {
    expect(names('photo', 2)).toHaveLength(2);
  });
});
