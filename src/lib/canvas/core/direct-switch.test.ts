import { describe, expect, it } from 'vitest';
import { directOn } from './direct-switch';

describe('directOn', () => {
  it('stays off without a param or a stored choice', () => {
    expect(directOn('', null)).toBe(false);
  });

  it('turns on from the url and the url beats storage', () => {
    expect(directOn('?directZoom=1', null)).toBe(true);
    expect(directOn('?directZoom=0', '1')).toBe(false);
  });

  it('follows the stored choice when the url says nothing', () => {
    expect(directOn('', '1')).toBe(true);
  });
});
