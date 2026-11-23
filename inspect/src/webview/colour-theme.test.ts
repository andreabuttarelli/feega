import { describe, expect, it } from 'vitest';
import { colourCheck, tokenPick } from './colour-theme';

const TOKENS = [
  { name: '--color-primary', value: '#1d3557' },
  { name: '--color-accent', value: 'rgb(255, 59, 48)' },
  { name: '--brand', value: '#00aa00' }
];

describe('colourCheck', () => {
  it('is on theme at a token, whatever its spelling', () => {
    expect(colourCheck('rgb(29, 53, 87)', TOKENS)).toEqual({ off: false, nearest: { name: '--color-primary', value: '#1d3557' } });
    expect(colourCheck('#FF3B30', TOKENS).off).toBe(false);
  });

  it('marks a free colour off theme and names the nearest token', () => {
    expect(colourCheck('rgb(30, 60, 90)', TOKENS)).toEqual({ off: true, nearest: { name: '--color-primary', value: '#1d3557' } });
  });

  it('has nothing to compare against without tokens', () => {
    expect(colourCheck('#123456', [])).toEqual({ off: false, nearest: null });
  });

  it('ignores a value that is not a colour', () => {
    expect(colourCheck('none', TOKENS)).toEqual({ off: false, nearest: null });
  });
});

describe('tokenPick', () => {
  it('names a Tailwind theme colour by its short name', () => {
    expect(tokenPick('--color-primary')).toEqual({ css: 'var(--color-primary)', token: 'primary' });
  });

  it('writes any other variable as an arbitrary value', () => {
    expect(tokenPick('--brand')).toEqual({ css: 'var(--brand)', token: '[var(--brand)]' });
  });
});
