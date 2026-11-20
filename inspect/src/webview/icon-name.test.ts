import { describe, expect, it } from 'vitest';
import { iconNameOf, maskOf, nextTile } from './icon-name';

describe('iconNameOf', () => {
  it.each([
    ['ArrowRight', 'arrow-right'],
    ['IconArrowRight', 'arrow-right'],
    ['ArrowRightIcon', 'arrow-right'],
    ['Heart', 'heart'],
    ['Disc3', 'disc3']
  ])('turns the component %s into the icon name %s', (component, name) => {
    expect(iconNameOf(component)).toBe(name);
  });

  it('has no name for a plain element', () => {
    expect(iconNameOf('svg')).toBeNull();
    expect(iconNameOf('')).toBeNull();
  });
});

describe('maskOf', () => {
  it('turns an svg into a css mask a script cannot run from', () => {
    const mask = maskOf('<svg><path d="M5 12h14"/></svg>');

    expect(mask.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(mask).not.toContain('<');
  });
});

describe('nextTile', () => {
  const COLUMNS = 6;

  it.each([
    ['ArrowRight', 0, 1],
    ['ArrowLeft', 3, 2],
    ['ArrowDown', 1, 7],
    ['ArrowUp', 8, 2]
  ])('%s from %i lands on %i', (key, from, to) => {
    expect(nextTile(key, from, 20, COLUMNS)).toBe(to);
  });

  it('stays inside the grid', () => {
    expect(nextTile('ArrowLeft', 0, 20, COLUMNS)).toBe(0);
    expect(nextTile('ArrowRight', 19, 20, COLUMNS)).toBe(19);
    expect(nextTile('ArrowDown', 18, 20, COLUMNS)).toBe(19);
  });

  it('goes back to the search box when moving up from the first row', () => {
    expect(nextTile('ArrowUp', 2, 20, COLUMNS)).toBe(-1);
  });

  it('ignores other keys', () => {
    expect(nextTile('a', 2, 20, COLUMNS)).toBe(2);
  });
});
