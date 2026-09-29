import { describe, expect, it } from 'vitest';
import { isHomeFile } from './seed-reference-images';

describe('isHomeFile', () => {
  it('skips homepage files removed from the Global catalogue', () => {
    expect(isHomeFile('home-dmt4auuo2.png')).toBe(true);
    expect(isHomeFile('home-updated-final.jpg')).toBe(true);
    expect(isHomeFile('home-updated-products.jpg')).toBe(true);
    expect(isHomeFile('home-updated.jpg')).toBe(true);
    expect(isHomeFile('home-vtzbfw8wm.png')).toBe(true);
  });

  it('keeps every other catalogue file', () => {
    expect(isHomeFile('01-tech-portrait.png')).toBe(false);
    expect(isHomeFile('model-02-studio.jpg')).toBe(false);
  });
});
