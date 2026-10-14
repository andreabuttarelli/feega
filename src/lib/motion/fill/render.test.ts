import { describe, expect, it } from 'vitest';
import { fillsSchema } from './model';
import { fillLayersHtml, resolveFills, svgFills, textPaint, type FillPaint } from './render';

const stack = (raw: unknown[]) => fillsSchema.parse(raw);
const paint: FillPaint = {
  id: 'a',
  size: { w: 200, h: 100 },
  color: (v) => (v.startsWith('#') ? v : `resolved(${v})`),
  asset: (id) => (id ? `https://cdn/${id}.png` : null)
};
const PATHS = '<path d="M0 0L200 0L200 100L0 100Z"/>';

describe('fill stack in svg', () => {
  it('draws one group per visible layer, bottom to top', () => {
    const { body } = svgFills(
      stack([
        { type: 'solid', color: '#111111' },
        { type: 'solid', color: '#222222' }
      ]),
      paint,
      PATHS,
      'nonzero'
    );
    expect(body.indexOf('#111111')).toBeLessThan(body.indexOf('#222222'));
    expect(body.match(/<path /g)).toHaveLength(2);
  });

  it('skips hidden layers', () => {
    const { body } = svgFills(stack([{ type: 'solid', color: '#111111', visible: false }]), paint, PATHS, 'nonzero');
    expect(body).toBe('');
  });

  it('carries layer opacity and blend mode', () => {
    const { body } = svgFills(
      stack([
        {
          type: 'solid',
          color: 'brand.accent',
          opacity: 0.4,
          blend: 'multiply'
        }
      ]),
      paint,
      PATHS,
      'evenodd'
    );
    expect(body).toContain('opacity="0.4"');
    expect(body).toContain('mix-blend-mode:multiply');
    expect(body).toContain('fill:resolved(brand.accent);fill-rule:evenodd;stroke:none');
  });

  it('a linear layer defines its stops along its angle', () => {
    const { defs, body } = svgFills(
      stack([
        {
          type: 'linear-gradient',
          angle: 0,
          stops: [
            { color: '#000000', pos: 0 },
            { color: 'brand.primary', pos: 0.7 },
            { color: '#ffffff', pos: 1 }
          ]
        }
      ]),
      paint,
      PATHS,
      'nonzero'
    );
    expect(defs).toContain('<linearGradient id="sg-a-f0" gradientUnits="userSpaceOnUse" x1="0" y1="50" x2="200" y2="50">');
    expect(defs).toContain('<stop offset="0.7" style="stop-color:resolved(brand.primary)"/>');
    expect(body).toContain('fill:url(#sg-a-f0)');
  });

  it('a radial layer sits on its centre with radius over half the long side', () => {
    const { defs } = svgFills(
      stack([
        {
          type: 'radial-gradient',
          center: { x: 0.25, y: 0.5 },
          radius: 0.5,
          stops: [
            { color: '#000000', pos: 0 },
            { color: '#ffffff', pos: 1 }
          ]
        }
      ]),
      paint,
      PATHS,
      'nonzero'
    );
    expect(defs).toContain('<radialGradient id="sg-a-f0" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="50">');
  });

  it('an image layer clips its picture to the outline with the resolved url', () => {
    const { defs, body } = svgFills(
      stack([
        {
          type: 'image',
          assetId: 'pic',
          fit: 'contain',
          focus: { x: 0, y: 1 }
        }
      ]),
      paint,
      PATHS,
      'nonzero'
    );
    expect(defs).toContain(`<clipPath id="sc-a-f0" clip-rule="nonzero">${PATHS}</clipPath>`);
    expect(body).toContain('<foreignObject x="0" y="0" width="200" height="100" clip-path="url(#sc-a-f0)">');
    expect(body).toContain('src="https://cdn/pic.png"');
    expect(body).toContain('object-fit:contain;object-position:0% 100%');
  });

  it('an image layer without a picture draws nothing', () => {
    expect(svgFills(stack([{ type: 'image' }]), paint, PATHS, 'nonzero').body).toBe('');
  });

  it('is the same string every time, so frames bake once', () => {
    const fills = stack([
      { type: 'image', assetId: 'pic' },
      { type: 'solid', color: '#000000', opacity: 0.3 }
    ]);
    expect(svgFills(fills, paint, PATHS, 'nonzero')).toEqual(svgFills(fills, paint, PATHS, 'nonzero'));
  });
});

describe('fill stack on text', () => {
  const text = (raw: unknown[]) => textPaint(stack(raw), paint.color, paint.asset);

  it('one opaque colour stays a plain text colour, so old text renders as before', () => {
    expect(text([{ type: 'solid', color: 'brand.text' }])).toEqual({ color: 'resolved(brand.text)' });
  });

  it('no visible layer is transparent text', () => {
    expect(text([{ type: 'solid', color: '#000000', visible: false }])).toEqual({ color: 'transparent' });
  });

  it('layers clip to the glyphs, top layer first as css lists them, opacity folded into each colour', () => {
    const css = text([
      { type: 'linear-gradient', angle: 0, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] },
      { type: 'solid', color: '#ff0000', opacity: 0.5, blend: 'multiply' }
    ]);
    expect(css.backgroundImage).toBe('linear-gradient(#ff000080,#ff000080),linear-gradient(90deg,#000000 0%,#ffffff 100%)');
    expect(css.backgroundBlendMode).toBe('multiply,normal');
    expect(css).toMatchObject({ backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' });
  });

  it('a picture fills the glyphs with its fit and focus', () => {
    const css = text([{ type: 'image', assetId: 'pic', fit: 'cover', focus: { x: 0.2, y: 0.8 } }, { type: 'solid', color: '#000000', opacity: 0.2 }]);
    expect(css.backgroundImage).toContain('url("https://cdn/pic.png")');
    expect(css.backgroundSize).toBe('auto,cover');
    expect(css.backgroundPosition).toBe('0% 0%,20% 80%');
  });
});

describe('fill stack in html', () => {
  const resolved = (raw: unknown[]) => resolveFills(stack(raw), paint.color, paint.asset);

  it('stacks one absolutely placed layer per visible fill, bottom first', () => {
    const html = fillLayersHtml(
      resolved([
        { type: 'solid', color: '#111111' },
        { type: 'solid', color: '#222222', visible: false },
        { type: 'solid', color: '#333333', opacity: 0.5 }
      ])
    );
    expect(html.match(/class="fl /g)).toHaveLength(2);
    expect(html.indexOf('#111111')).toBeLessThan(html.indexOf('#333333'));
    expect(html).toContain('opacity:0.5');
  });

  it('a linear layer is a css gradient turned to the same direction', () => {
    expect(
      fillLayersHtml(
        resolved([
          {
            type: 'linear-gradient',
            angle: 0,
            stops: [
              { color: '#000000', pos: 0 },
              { color: '#ffffff', pos: 1 }
            ]
          }
        ])
      )
    ).toContain('linear-gradient(90deg,#000000 0%,#ffffff 100%)');
  });

  it('a radial layer is a circle over half the long side at its centre', () => {
    expect(
      fillLayersHtml(
        resolved([
          {
            type: 'radial-gradient',
            center: { x: 0.25, y: 0.75 },
            radius: 2,
            stops: [
              { color: '#000000', pos: 0 },
              { color: '#ffffff', pos: 1 }
            ]
          }
        ])
      )
    ).toContain('radial-gradient(circle calc(max(100cqw,100cqh) * 1) at 25% 75%,#000000 0%,#ffffff 100%)');
  });

  it('an image layer is an img with fit, focus and scale', () => {
    const html = fillLayersHtml(
      resolved([
        {
          type: 'image',
          assetId: 'pic',
          fit: 'fill',
          focus: { x: 0.2, y: 0.3 },
          scale: 1.5
        }
      ])
    );
    expect(html).toContain('<img class="fl-image" decoding="sync" draggable="false" src="https://cdn/pic.png"');
    expect(html).toContain('object-fit:fill;object-position:20% 30%;transform:scale(1.5);transform-origin:20% 30%');
  });

  it('a tiled image repeats a background scaled to a quarter of the box', () => {
    expect(fillLayersHtml(resolved([{ type: 'image', assetId: 'pic', fit: 'tile', scale: 2 }]))).toContain('background-image:url(&quot;https://cdn/pic.png&quot;);background-repeat:repeat;background-size:50% auto');
  });

  it('escapes the picture url', () => {
    expect(fillLayersHtml(resolveFills(stack([{ type: 'image', src: 'https://x/a"b.png' }]), paint.color, () => null))).toContain('a&quot;b.png');
  });

  it('runs on its own, so the poster runtime can inline it', () => {
    const inlined = new Function(`return (${fillLayersHtml.toString()})`)();
    const fills = resolved([{ type: 'solid', color: '#111111' }]);
    expect(inlined(fills)).toBe(fillLayersHtml(fills));
  });
});
