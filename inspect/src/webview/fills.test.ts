import { describe, expect, it } from 'vitest';
import { FillKind, fillCss, parseFills, tailwindFill } from './fills';

describe('parseFills', () => {
  it('a plain background colour is one solid layer', () => {
    expect(parseFills('none', 'rgb(255, 204, 0)')).toEqual([{ kind: FillKind.Solid, colour: 'rgb(255, 204, 0)', visible: true }]);
  });

  it('transparent with no image is no fill at all', () => {
    expect(parseFills('none', 'rgba(0, 0, 0, 0)')).toEqual([]);
  });

  it('gradients come first, top layer first, with angle and stops', () => {
    const fills = parseFills('linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%), radial-gradient(circle, rgb(0, 0, 0) 10%, rgba(0, 0, 0, 0) 60%)', 'rgb(255, 255, 255)');

    expect(fills.map((f) => f.kind)).toEqual([FillKind.Linear, FillKind.Radial, FillKind.Solid]);
    expect(fills[0]).toMatchObject({ angle: '90deg', stops: [{ colour: 'rgb(255, 0, 0)', at: '0%' }, { colour: 'rgb(0, 0, 255)', at: '100%' }] });
    expect(fills[1]).toMatchObject({ shape: 'circle', stops: [{ colour: 'rgb(0, 0, 0)', at: '10%' }, { colour: 'rgba(0, 0, 0, 0)', at: '60%' }] });
  });

  it('an image layer keeps its url', () => {
    expect(parseFills('url("/hero.png")', 'rgba(0, 0, 0, 0)')).toEqual([{ kind: FillKind.Image, url: '/hero.png', visible: true }]);
  });
});

describe('fillCss', () => {
  it('round-trips layers into background-image and background-color', () => {
    const image = 'linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%), url("/a.png")';
    const fills = parseFills(image, 'rgb(255, 255, 255)');

    expect(fillCss(fills)).toEqual({ 'background-image': image, 'background-color': 'rgb(255, 255, 255)' });
  });

  it('hidden layers are left out', () => {
    const [solid] = parseFills('none', 'rgb(1, 2, 3)');

    expect(fillCss([{ ...solid, visible: false }])).toEqual({ 'background-image': 'none', 'background-color': 'transparent' });
  });
});

describe('tailwindFill', () => {
  it('a single solid is a bg colour class; anything else arbitrary', () => {
    expect(tailwindFill(parseFills('none', '#ffcc00'))).toEqual(['bg-[#ffcc00]']);
    expect(tailwindFill(parseFills('linear-gradient(90deg, red 0%, blue 100%)', 'rgba(0, 0, 0, 0)'))).toEqual(['bg-[linear-gradient(90deg,red_0%,blue_100%)]']);
  });
});
