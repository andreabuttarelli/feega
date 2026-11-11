import { describe, expect, it } from 'vitest';
import { MotionFormat } from '@feega/motion-core/motion/doc';
import { ComponentKind, type CatalogueItem } from './catalogue';
import { DocMode } from '@feega/motion-core/motion/still';
import { BUILTIN_PREFIX } from './design-kit';
import { filterGroup, groupItems, groupTitle, shortName, YOUR_LIBRARY } from './library-groups';

const item = (id: string, name: string): CatalogueItem => ({ id, name, description: '', seconds: 1, kind: ComponentKind.Scene, mode: DocMode.Video, format: MotionFormat.Landscape, roles: [], fields: [], preview: null });

const items = [
  item(`${BUILTIN_PREFIX}a`, 'Launch · Word burst'),
  item(`${BUILTIN_PREFIX}b`, 'Scene · Hero title'),
  item(`${BUILTIN_PREFIX}c`, 'Launch · Device fly-in'),
  item('org-1', 'Mine · thing'),
  item(`${BUILTIN_PREFIX}d`, 'Plain')
];

describe('library groups', () => {
  it('groups built-ins by name prefix, own templates first and the unprefixed ones last', () => {
    expect(groupItems(items).map((g) => [g.title, g.items.length])).toEqual([[YOUR_LIBRARY, 1], ['Launch', 2], ['Scene', 1], ['Other', 1]]);
  });

  it('strips the group prefix from built-in names only', () => {
    expect(shortName(items[0])).toBe('Word burst');
    expect(shortName(items[3])).toBe('Mine · thing');
  });

  it('filters to one group', () => {
    expect(filterGroup(items, 'Launch').map(groupTitle)).toEqual(['Launch', 'Launch']);
    expect(filterGroup(items, null)).toHaveLength(5);
  });
});
