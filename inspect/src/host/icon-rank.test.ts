import { describe, expect, it } from 'vitest';
import { rankNames, suggestNames } from './icon-rank';

const NAMES = ['a-arrow-up', 'arrow-up-01', 'arrow-right', 'arrow', 'dart', 'move-arrow', 'arrow-left', 'x', 'heart', 'house'];

describe('rankNames', () => {
  it('puts the exact name, then prefixes, then words, then substrings', () => {
    expect(rankNames(NAMES, 'arrow', null)).toEqual(['arrow', 'arrow-left', 'arrow-right', 'arrow-up-01', 'a-arrow-up', 'move-arrow']);
  });

  it('finds a substring that is not a word last', () => {
    expect(rankNames(NAMES, 'art', null)).toEqual(['dart', 'heart']);
  });

  it('puts the selected icon first when it matches', () => {
    expect(rankNames(NAMES, 'arrow', 'move-arrow')[0]).toBe('move-arrow');
  });

  it('ignores the selected icon when it does not match', () => {
    expect(rankNames(NAMES, 'arrow', 'heart')).not.toContain('heart');
  });

  it('is case insensitive and trims', () => {
    expect(rankNames(NAMES, '  ARROW-R ', null)).toEqual(['arrow-right']);
  });
});

describe('suggestNames', () => {
  it('lists the selected icon, then its family, then popular icons, then the rest', () => {
    const names = ['zap', 'arrow-left', 'arrow-up', 'heart', 'arrow-right', 'abacus'];

    expect(suggestNames(names, 'arrow-right')).toEqual(['arrow-right', 'arrow-up', 'arrow-left', 'heart', 'abacus', 'zap']);
  });

  it('starts with popular icons when nothing is selected', () => {
    expect(suggestNames(['zap', 'house', 'abacus', 'heart'], null)).toEqual(['heart', 'house', 'abacus', 'zap']);
  });
});
