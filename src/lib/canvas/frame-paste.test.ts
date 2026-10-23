import { describe, expect, it } from 'vitest';
import { Background, MotionFormat, compOf, newMotionDoc, type MotionClip } from '$lib/motion/doc';
import { FEEGA_TOKENS, resolveColor } from '$lib/motion/brand';
import { TextSizing } from '$lib/motion/text-sizing';
import { pastedInFrame } from './frame-paste';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">
  <rect x="0" y="0" width="40" height="50" fill="#ff0000"/>
  <rect x="60" y="0" width="40" height="50" fill="#0000ff"/>
</svg>`;

const ids = () => {
  let n = 0;
  return () => `p${++n}`;
};

const frame = newMotionDoc(MotionFormat.Landscape);
const AT = { x: 0.5, y: 0.5 };
const topClips = (doc: typeof frame) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('pastedInFrame', () => {
  it('lands an SVG inside the frame as one group of coloured shapes, in a single edit', () => {
    const done = pastedInFrame(frame, { svg: SVG }, AT, 2, 0, ids())!;

    const [group] = topClips(done.doc);
    expect(topClips(done.doc)).toHaveLength(1);
    expect(compOf(group)).not.toBeNull();
    expect(done.selection).toEqual([group.id]);
    expect(done.doc.comps[compOf(group)!].tracks.flatMap((t) => t.clips).map((c) => c.props.fill)).toEqual(['#ff0000', '#0000ff']);
  });

  it('keeps the SVG centred on the pointer at the canvas scale', () => {
    const done = pastedInFrame(frame, { svg: SVG }, AT, 2, 0, ids())!;
    const shapes = done.doc.comps[compOf(topClips(done.doc)[0])!].tracks.flatMap((t) => t.clips);
    const left = shapes[0].props as { x: number; width: number };

    expect((left.x - left.width / 2) * frame.width).toBeCloseTo(frame.width / 2 - 100, 0);
    expect(left.width * frame.width).toBeCloseTo(80, 0);
  });

  it('pastes text that reads on a dark frame and grows sideways instead of wrapping', () => {
    const done = pastedInFrame({ ...frame, background: Background.Brand }, { text: 'Hello there' }, AT, 2, 0, ids())!;
    const text = topClips(done.doc)[0];

    expect(text.props.text).toBe('Hello there');
    expect(text.props.sizing).toBe(TextSizing.AutoWidth);
    expect(Math.abs(luminance(resolveColor(text.props.color, FEEGA_TOKENS)) - luminance(FEEGA_TOKENS.colors['brand.background']))).toBeGreaterThan(0.5);
    expect(done.selection).toEqual([text.id]);
  });

  it('keeps a gradient fill on the pasted shape', () => {
    const svg = `<svg viewBox="0 0 10 10"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`;
    const done = pastedInFrame(frame, { svg }, AT, 1, 0, ids())!;

    expect(topClips(done.doc)[0].props.fills).toMatchObject([{ type: 'linear-gradient', angle: 90 }]);
  });

  it('turns SVG text into text clips next to the shapes', () => {
    const svg = `<svg viewBox="0 0 100 50"><rect width="100" height="50" fill="#eee"/><text x="10" y="30" font-size="20" fill="#336699">Hi</text></svg>`;
    const done = pastedInFrame(frame, { svg }, AT, 1, 0, ids())!;
    const clips = done.doc.comps[compOf(topClips(done.doc)[0])!].tracks.flatMap((t) => t.clips);
    const text = clips.find((c) => c.component === 'Text')!;

    expect(text.props).toMatchObject({ text: 'Hi', color: '#336699' });
  });

  it('pastes an SVG made only of text', () => {
    const done = pastedInFrame(frame, { svg: `<svg viewBox="0 0 100 50"><text x="10" y="30" font-size="20">Only</text></svg>` }, AT, 1, 0, ids())!;

    expect(topClips(done.doc)[0].props.text).toBe('Only');
  });

  it('pastes nothing from an SVG without shapes', () => {
    expect(pastedInFrame(frame, { svg: '<svg></svg>' }, AT, 2, 0, ids())).toBeNull();
  });
});
