import { describe, expect, it } from 'vitest';
import { SOURCES, creditLine } from './registry';

describe('creditLine', () => {
  it('names the library and its license', () => {
    expect(creditLine({ name: 'Lucide', url: 'https://lucide.dev', license: 'ISC' })).toBe('Built on Lucide · ISC');
  });

  it('is empty without a credit', () => {
    expect(creditLine(undefined)).toBe('');
  });
});

describe('credits', () => {
  it('credit every plugin that wraps a third-party icon or logo set', () => {
    const credited = SOURCES.filter((source) => source.credit).map((source) => source.id);

    expect(credited).toEqual(['lucide-icons', 'brand-logos', 'phosphor-icons', 'heroicons']);
  });
});
