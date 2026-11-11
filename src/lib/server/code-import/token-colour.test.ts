import { describe, expect, it } from 'vitest';
import { colourOf, writtenLike } from './token-colour';

describe('colourOf', () => {
  it.each([
    ['#111111', '#111111'],
    ['#FFF', '#ffffff'],
    ['#11223380', '#11223380'],
    ['rgb(17 34 51)', '#112233'],
    ['rgba(17, 34, 51, 0.5)', '#11223380'],
    ['hsl(0 0% 100%)', '#ffffff'],
    ['0 0% 3.9%', '#0a0a0a'],
    ['oklch(1 0 0)', '#ffffff'],
    ['oklch(0.145 0 0)', '#0a0a0a'],
    ['oklch(57.7% 0.245 27.325)', '#e7000b'],
    ['white', '#ffffff'],
    ['transparent', '#00000000']
  ])('legge %s come %s', (raw, hex) => {
    expect(colourOf(raw)).toBe(hex);
  });

  it.each(['var(--x)', 'calc(1px)', 'currentColor', '1rem', 'Inter, sans-serif'])('non è un colore: %s', (raw) => {
    expect(colourOf(raw)).toBeNull();
  });
});

describe('writtenLike', () => {
  it.each([
    ['#111111', '#222222', '#222222'],
    ['#FFF', '#abcdef', '#abcdef'],
    ['rgb(17 34 51)', '#ff0000', 'rgb(255 0 0)'],
    ['hsl(0 0% 100%)', '#000000', 'hsl(0 0% 0%)'],
    ['0 0% 3.9%', '#ffffff', '0 0% 100%'],
    ['oklch(0.145 0 0)', '#ffffff', 'oklch(1 0 0)'],
    ['white', '#ff0000', '#ff0000']
  ])('scrive nel formato di %s', (raw, hex, written) => {
    expect(writtenLike(raw, hex)).toBe(written);
  });

  it('un oklch riscritto si rilegge allo stesso colore', () => {
    const written = writtenLike('oklch(0.5 0.1 200)', '#3a7bd5');
    expect(written).toMatch(/^oklch\(/);
    expect(colourOf(written)).toBe('#3a7bd5');
  });
});
