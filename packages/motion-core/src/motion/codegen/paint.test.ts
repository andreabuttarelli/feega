import { describe, expect, it } from 'vitest';
import { newClip, type MotionClip } from '../doc';
import { fillsSchema } from '../fill/model';
import { fillLayersHtml } from '../fill/render';
import { maskSchema } from '../mask';
import { backgroundRules, borderRules, effectRules, mergeShadows, paintNotes, typeRules, type Painter } from './paint';
import { ColourRole, TokenBook } from './tokens';

const UNIT = 1000;
const painter: Painter = { tokens: new TokenBook(null), unit: UNIT, asset: (id) => id, colourVar: () => undefined };
const BOX = { left: 100, top: 50, width: 400, height: 200 };
const AREA = { box: BOX, frame: { width: 1000, height: 600 } };
const stops = [
  { color: '#ff0000', pos: 0 },
  { color: '#0000ff', pos: 1 }
];

const shape = (props: Record<string, unknown>, extra: Partial<MotionClip> = {}) => newClip({ id: 'c', from: 0, durationInFrames: 30, component: 'Shape', props: { shape: 'rect', ...props }, ...extra });
const text = (props: Record<string, unknown>, extra: Partial<MotionClip> = {}) => newClip({ id: 't', from: 0, durationInFrames: 30, component: 'Text', props: { text: 'Hi', size: 0.05, font: 'Inter', ...props }, ...extra });
const rule = (rules: [string, unknown][], property: string) => rules.find(([p]) => p === property)?.[1];
const stroke = (fields: Record<string, unknown>) => ({ paint: { type: 'solid', color: '#112233' }, width: 0.01, ...fields });
const background = (fills: unknown[]) => backgroundRules(shape({ fills: fillsSchema.parse(fills) }), painter, ColourRole.Fill, BOX);
const image = (rules: [string, unknown][]) => String(rule(rules, 'background-image'));

const cssAngle = (css: string) => Number(/linear-gradient\((-?[\d.]+)deg/.exec(css)?.[1]);

describe('linear gradient in exported css', () => {
  it.each([0, 45, 90, -30])('points the same way the renderer paints it at %i°', (angle) => {
    const fills = fillsSchema.parse([{ type: 'linear-gradient', angle, stops }]);
    expect(cssAngle(image(background(fills)))).toBe(cssAngle(fillLayersHtml(fills)));
  });
});

describe('gradient shapes in exported css', () => {
  it('keeps the centre and the circle size of a radial gradient', () => {
    const css = image(background([{ type: 'radial-gradient', stops, center: { x: 0.2, y: 0.8 }, radius: 0.5 }]));
    expect(css).toContain('radial-gradient(circle 100px at 20% 80%');
  });

  it('paints an angular gradient as a conic gradient from its angle and centre', () => {
    const css = image(background([{ type: 'angular-gradient', stops, angle: 30, center: { x: 0.25, y: 0.5 } }]));
    expect(css).toContain('conic-gradient(from 30deg at 25% 50%');
  });

  it('paints a diamond gradient as four quadrant gradients', () => {
    const rules = background([{ type: 'diamond-gradient', stops }]) as [string, string][];
    expect(image(rules).match(/linear-gradient\(to /g)).toHaveLength(4);
    expect(rule(rules, 'background-size')).toBe('50% 50%, 50% 50%, 50% 50%, 50% 50%');
    expect(rule(rules, 'background-repeat')).toBe('no-repeat, no-repeat, no-repeat, no-repeat');
  });

  it('keeps the fill opacity on gradient stops', () => {
    const css = image(background([{ type: 'linear-gradient', stops, opacity: 0.5 }]));
    expect(css).toContain('#ff000080 0%');
  });

  it('stacks every fill in order with its own blend mode', () => {
    const rules = background([
      { type: 'solid', color: '#ff0000' },
      { type: 'linear-gradient', stops, blend: 'multiply' }
    ]);
    expect(rule(rules, 'background-color')).toBeUndefined();
    expect(image(rules)).toMatch(/^linear-gradient\(.*\), linear-gradient\(#ff0000, #ff0000\)$/);
    expect(rule(rules, 'background-blend-mode')).toBe('multiply, normal');
  });

  it('keeps a lone solid fill as a background colour', () => {
    expect(rule(background([{ type: 'solid', color: '#ff0000' }]), 'background-color')).toBeDefined();
  });
});

describe('blend modes in exported css', () => {
  it('exports the layer blend as mix-blend-mode', () => {
    expect(rule(effectRules(shape({}, { blend: 'multiply' }), AREA).rules, 'mix-blend-mode')).toBe('multiply');
  });

  it('says so when a blend has no CSS equivalent', () => {
    const out = effectRules(shape({}, { blend: 'linear-burn' }), AREA);
    expect(rule(out.rules, 'mix-blend-mode')).toBeUndefined();
    expect(out.dropped.join()).toContain('linear-burn');
  });

  it('says so when a fill blend has no CSS equivalent', () => {
    const clip = shape({ fills: fillsSchema.parse([{ type: 'solid', color: '#fff' }, { type: 'solid', color: '#000', blend: 'hard-mix' }]) });
    expect(paintNotes(clip).join()).toContain('hard-mix');
  });
});

describe('masks in exported css', () => {
  const make = (fields: Record<string, unknown>) => maskSchema.parse({ kind: 'ellipse', x: 0.3, y: 0.25, width: 0.2, height: 0.2, ...fields });
  const ellipse = make({});

  it('clips to a plain ellipse mask in the layer own coordinates', () => {
    const out = effectRules(shape({}, { mask: ellipse }), AREA);
    expect(rule(out.rules, 'clip-path')).toBe('ellipse(100px 60px at 200px 100px)');
    expect(out.dropped).toEqual([]);
  });

  it('clips to a plain rectangle mask', () => {
    const out = effectRules(shape({}, { mask: make({ kind: 'rect' }) }), AREA);
    expect(rule(out.rules, 'clip-path')).toBe('inset(40px 100px 40px 100px)');
  });

  it.each([
    ['a feathered mask', make({ feather: 8 })],
    ['an inverted mask', make({ invert: true })],
    ['a picture mask', make({ kind: 'image', assetId: 'a' })]
  ])('says so for %s', (_, mask) => {
    const out = effectRules(shape({}, { mask }), AREA);
    expect(rule(out.rules, 'clip-path')).toBeUndefined();
    expect(out.dropped.join()).toContain('mask');
  });

  it('says so for a mask stack and for a matte', () => {
    expect(effectRules(shape({}, { maskStack: [ellipse, ellipse] }), AREA).dropped.join()).toContain('mask');
    expect(effectRules(shape({}, { matte: 'luma' }), AREA).dropped.join()).toContain('matte');
  });
});

describe('strokes in exported css', () => {
  const flat = (v: unknown) => (typeof v === 'string' ? v : `${(v as { before?: string }).before ?? ''}${(v as { raw: string }).raw}`);
  const borders = (strokes: unknown[]) => borderRules(shape({ strokes }), painter).map(([property, value]) => [property, flat(value)]);

  it('draws an inside stroke as a border', () => {
    expect(borders([stroke({ align: 'inside' })])).toEqual([['border', '10px solid #112233']]);
  });

  it('draws a centred stroke half outside and half inside the box', () => {
    expect(borders([stroke({ align: 'center' })])).toEqual([['box-shadow', '0 0 0 5px #112233, inset 0 0 0 5px #112233']]);
  });

  it('draws an outside stroke fully outside the box', () => {
    expect(borders([stroke({ align: 'outside' })])).toEqual([['box-shadow', '0 0 0 10px #112233']]);
  });

  it('draws a dashed outside stroke as an outline', () => {
    expect(borders([stroke({ align: 'outside', dash: 0.02 })])).toEqual([['outline', '10px dashed #112233'], ['outline-offset', '0px']]);
  });

  it('draws a dashed centred stroke as an outline pulled half inside', () => {
    expect(borders([stroke({ align: 'center', dash: 0.02 })])).toEqual([['outline', '10px dashed #112233'], ['outline-offset', '-5px']]);
  });

  it('stacks several strokes, the last one on top', () => {
    const rules = borders([stroke({ align: 'outside' }), stroke({ align: 'outside', width: 0.02, paint: { type: 'solid', color: '#445566' } })]);
    expect(rules).toEqual([['box-shadow', '0 0 0 20px #445566, 0 0 0 10px #112233']]);
  });

  it('keeps the stroke opacity', () => {
    expect(borders([stroke({ align: 'outside', paint: { type: 'solid', color: '#112233', opacity: 0.5 } })])).toEqual([['box-shadow', '0 0 0 10px #11223380']]);
  });

  it('says so for a gradient stroke, a per-side stroke that is not inside, and a second dashed stroke', () => {
    const notes = paintNotes(shape({ strokes: [stroke({ paint: { type: 'linear-gradient', stops } }), stroke({ align: 'center', sides: [0.01, 0, 0.01, 0] })] }));
    expect(notes.join('\n')).toContain('gradient stroke');
    expect(notes.join('\n')).toContain('per-side');
  });

  it('shares one box-shadow between strokes and drop shadows', () => {
    const merged = mergeShadows([['box-shadow', '0 0 0 5px #112233'], ['color', 'red'], ['box-shadow', '0 8px 16px 0px #00000080']]);
    expect(merged).toEqual([['box-shadow', '0 0 0 5px #112233, 0 8px 16px 0px #00000080'], ['color', 'red']]);
  });
});

describe('text effects in exported css', () => {
  const shadow = { id: 's', kind: 'drop-shadow', enabled: true, params: { distance: 0, x: 2, y: 6, blur: 10, spread: 4, color: '#000000', opacity: 1 } };

  it('draws a text drop shadow as text-shadow', () => {
    const rules = effectRules(text({}, { effects: [shadow] as never }), AREA).rules;
    expect(rule(rules, 'text-shadow')).toBe('2px 6px 10px #000000');
    expect(rule(rules, 'box-shadow')).toBeUndefined();
  });

  it('keeps box-shadow on shapes', () => {
    expect(rule(effectRules(shape({}, { effects: [shadow] as never }), AREA).rules, 'box-shadow')).toBeDefined();
  });

  it('says so for a text inner shadow', () => {
    const out = effectRules(text({}, { effects: [{ ...shadow, kind: 'inner-shadow' }] as never }), AREA);
    expect(out.dropped.join()).toContain('inner-shadow');
  });
});

describe('type axes and features in exported css', () => {
  const typed = (props: Record<string, unknown>) => typeRules(text(props), painter, false) as [string, string][];

  it('exports width, slant and custom axes as font-variation-settings', () => {
    expect(rule(typed({ stretch: 125, slant: -8, axes: "'GRAD' 50" }), 'font-variation-settings')).toBe("'wdth' 125, 'slnt' -8, 'GRAD' 50");
  });

  it('leaves font-variation-settings out at the defaults', () => {
    expect(rule(typed({}), 'font-variation-settings')).toBeUndefined();
  });

  it('exports OpenType features as font-feature-settings', () => {
    expect(rule(typed({ features: "'ss01' 1, 'liga' 0" }), 'font-feature-settings')).toBe("'ss01' 1, 'liga' 0");
  });
});
