import { describe, expect, it } from 'vitest';
import { parseShadows, shadowCss, tailwindShadow } from './shadows';

describe('parseShadows', () => {
  it('reads the computed list with colours, inset and spread', () => {
    expect(parseShadows('rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgb(0, 120, 212) 0px 0px 0px 2px inset')).toEqual([
      { x: 0, y: 10, blur: 15, spread: -3, colour: 'rgba(0, 0, 0, 0.1)', inset: false, visible: true },
      { x: 0, y: 0, blur: 0, spread: 2, colour: 'rgb(0, 120, 212)', inset: true, visible: true }
    ]);
  });

  it('none is an empty list', () => {
    expect(parseShadows('none')).toEqual([]);
  });

  it('drops the transparent zero layers Tailwind adds', () => {
    expect(parseShadows('rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 1px 2px 0px')).toHaveLength(1);
  });
});

describe('shadowCss', () => {
  it('round-trips a list, hidden layers left out', () => {
    const css = 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgb(0, 120, 212) 0px 0px 0px 2px inset';
    const layers = parseShadows(css);

    expect(shadowCss(layers)).toBe('0px 10px 15px -3px rgba(0, 0, 0, 0.1), inset 0px 0px 0px 2px rgb(0, 120, 212)');
    expect(shadowCss([{ ...layers[0], visible: false }])).toBe('none');
  });
});

describe('tailwindShadow', () => {
  it('a list equal to a token is the token, anything else an arbitrary class', () => {
    expect(tailwindShadow('none')).toBe('shadow-none');
    expect(tailwindShadow('0px 10px 15px -3px rgba(0, 0, 0, 0.1)')).toBe('shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1)]');
  });
});
