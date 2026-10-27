import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { TokenRole, cssText, devLayer, tailwindClasses } from './dev-css';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const FRAME = newMotionDoc(MotionFormat.Landscape);

const withShape = must(
  addClip(FRAME, { component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.25, height: 0.1, roundness: 0.25, fill: 'brand.accent', opacity: 0.5, rotation: 12 } }, 'card')
);

const withTitle = must(
  addClip(withShape, { component: 'Title', from: 0, durationInFrames: 60, props: { text: 'Hello', x: 0.5, y: 0.2, width: 0.5, height: 0.2, size: 0.1, weight: 700, tracking: -0.04, leading: 0.95, color: '#112233', font: 'mono', align: 'left' } }, 'title')
);

describe('the CSS of a layer', () => {
  it('positions a layer by its box in the frame', () => {
    const layer = devLayer(withShape, 'card', FEEGA_TOKENS)!;

    expect(layer.box).toEqual({ left: 720, top: 486, width: 480, height: 108 });
    expect(cssText(layer)).toContain('left: 720px;\ntop: 486px;\nwidth: 480px;\nheight: 108px;');
  });

  it('paints a shape with its fill, corner radius, opacity and rotation', () => {
    const css = cssText(devLayer(withShape, 'card', FEEGA_TOKENS)!);

    expect(css).toContain('background: #0099ff;');
    expect(css).toContain('border-radius: 27px;');
    expect(css).toContain('opacity: 0.5;');
    expect(css).toContain('transform: rotate(12deg);');
  });

  it('writes the type of a text layer', () => {
    const css = cssText(devLayer(withTitle, 'title', FEEGA_TOKENS)!);

    expect(css).toContain('color: #112233;');
    expect(css).toContain('font-family: mono;');
    expect(css).toContain('font-size: 108px;');
    expect(css).toContain('font-weight: 700;');
    expect(css).toContain('letter-spacing: -0.04em;');
    expect(css).toContain('line-height: 0.95;');
    expect(css).toContain('text-align: left;');
  });

  it('names the brand colour a layer uses', () => {
    const layer = devLayer(withShape, 'card', FEEGA_TOKENS)!;

    expect(layer.tokens).toContainEqual({ role: TokenRole.Colour, name: 'brand.accent', value: '#0099ff' });
  });

  it('keeps the variable name when the brand is unknown', () => {
    const layer = devLayer(withShape, 'card', null)!;

    expect(cssText(layer)).toContain('background: var(--brand-accent);');
    expect(layer.tokens).toContainEqual({ role: TokenRole.Colour, name: 'brand.accent', value: null });
  });

  it('names the font of a text layer', () => {
    const layer = devLayer(withTitle, 'title', FEEGA_TOKENS)!;

    expect(layer.tokens).toContainEqual({ role: TokenRole.Font, name: 'mono', value: '700' });
  });

  it('gives nothing for a layer that is not there', () => {
    expect(devLayer(withShape, 'ghost', FEEGA_TOKENS)).toBeNull();
  });
});

describe('the Tailwind classes of a layer', () => {
  it('uses arbitrary values for the box and the type', () => {
    const classes = tailwindClasses(devLayer(withTitle, 'title', FEEGA_TOKENS)!);

    expect(classes).toContain('absolute');
    expect(classes).toContain('left-[480px]');
    expect(classes).toContain('w-[960px]');
    expect(classes).toContain('text-[108px]');
    expect(classes).toContain('font-[700]');
    expect(classes).toContain('text-[#112233]');
  });
});
