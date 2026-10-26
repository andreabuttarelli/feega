import { describe, expect, it } from 'vitest';
import { idsFromLink, selectionLink } from './selection-link';

describe('selection link', () => {
  it('round-trips the selected ids through the url', () => {
    const link = selectionLink(new URL('https://feega.app/p/1/c/2?x=1'), ['a', 'b']);
    expect(link).toBe('https://feega.app/p/1/c/2?x=1&nodes=a%2Cb');
    expect(idsFromLink(new URL(link).searchParams)).toEqual(['a', 'b']);
  });

  it('reads no ids when the param is absent or empty', () => {
    expect(idsFromLink(new URLSearchParams(''))).toEqual([]);
    expect(idsFromLink(new URLSearchParams('nodes='))).toEqual([]);
  });
});
