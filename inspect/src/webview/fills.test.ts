import { describe, expect, it } from 'vitest';
import { FillKind, fillCss, imageChanged, newFill, parseFills, placementCss, tailwindFill, tailwindImage } from './fills';

describe('image placement', () => {
  const placement = { size: 'cover, auto', repeat: 'no-repeat, repeat', position: '50% 0%, 0% 0%' };

  it('parse hands each image layer its own size, repeat and position', () => {
    const [image, gradient] = parseFills('url("/a.png"), linear-gradient(90deg, red 0%, blue 100%)', 'rgba(0, 0, 0, 0)', placement);

    expect(image).toMatchObject({ kind: FillKind.Image, url: '/a.png', size: 'cover', repeat: 'no-repeat', position: '50% 0%' });
    expect(gradient.kind).toBe(FillKind.Linear);
  });

  it('a local dev-server url is read back as the root-relative path the source holds', () => {
    const [image] = parseFills('url("http://127.0.0.1:49397/images/sunset.svg")', 'rgba(0, 0, 0, 0)');

    expect(image).toMatchObject({ url: '/images/sunset.svg' });
  });

  it('a remote url is kept as it is', () => {
    const [image] = parseFills('url("https://cdn.example.com/a.png")', 'rgba(0, 0, 0, 0)');

    expect(image).toMatchObject({ url: 'https://cdn.example.com/a.png' });
  });

  it('a new image layer covers, does not repeat and is centred', () => {
    expect(newFill(FillKind.Image)).toMatchObject({ size: 'cover', repeat: 'no-repeat', position: '50% 50%' });
  });

  it('placementCss lists one value per painted layer, defaults for gradients', () => {
    const fills = parseFills('url("/a.png"), linear-gradient(90deg, red 0%, blue 100%)', 'rgba(0, 0, 0, 0)', placement);

    expect(placementCss(fills)).toEqual({ 'background-size': 'cover, auto', 'background-repeat': 'no-repeat, repeat', 'background-position': '50% 0%, 0% 0%' });
  });

  it('placementCss with no painted layer is the browser default', () => {
    expect(placementCss([])).toEqual({ 'background-size': 'auto', 'background-repeat': 'repeat', 'background-position': '0% 0%' });
  });

  it('a hidden or blank image layer takes no slot', () => {
    const fills = [
      { ...newFill(FillKind.Image), url: '/a.png', visible: false },
      { ...newFill(FillKind.Image), url: '' }
    ];

    expect(placementCss(fills)['background-size']).toBe('auto');
  });
});

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
    expect(parseFills('url("/hero.png")', 'rgba(0, 0, 0, 0)')).toEqual([{ kind: FillKind.Image, url: '/hero.png', size: 'auto', repeat: 'repeat', position: '0% 0%', visible: true }]);
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

describe('an image layer without a url', () => {
  const empty = [newFill(FillKind.Image)];

  it('writes no url("")', () => {
    expect(fillCss(empty)).toEqual({ 'background-image': 'none', 'background-color': 'transparent' });
    expect(tailwindFill(empty)).toEqual([]);
  });

  it('keeps the layers beside it', () => {
    const [solid] = parseFills('none', 'rgb(1, 2, 3)');

    expect(fillCss([...empty, solid])['background-image']).toBe('none');
  });
});

describe('tailwindFill', () => {
  it('a single solid is a bg colour class; anything else arbitrary', () => {
    expect(tailwindFill(parseFills('none', '#ffcc00'))).toEqual(['bg-[#ffcc00]']);
    expect(tailwindFill(parseFills('linear-gradient(90deg, red 0%, blue 100%)', 'rgba(0, 0, 0, 0)'))).toEqual(['bg-[linear-gradient(90deg,red_0%,blue_100%)]']);
  });
});

describe('imageChanged', () => {
  it('setting a colour on an element with no image does not write an image', () => {
    expect(imageChanged('none', 'none')).toBe(false);
  });

  it('removing the last image writes none', () => {
    expect(imageChanged('url("/a.png")', 'none')).toBe(true);
  });

  it('adding an image writes it', () => {
    expect(imageChanged('none', 'url("/a.png")')).toBe(true);
  });
});

describe('tailwindImage', () => {
  it('a single url is a bg-[url()] class, unquoted', () => {
    expect(tailwindImage('url("/images/x.jpg")')).toBe('bg-[url(/images/x.jpg)]');
  });

  it('layers stay an arbitrary background-image', () => {
    expect(tailwindImage('url("/a.png"), linear-gradient(90deg, red 0%, blue 100%)')).toBe('[background-image:url("/a.png"),linear-gradient(90deg,red_0%,blue_100%)]');
  });
});
