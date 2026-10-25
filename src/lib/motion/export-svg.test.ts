import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { Background, MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { FillType } from '@feega/motion-core/motion/fill/model';
import { BlendMode } from '@feega/motion-core/motion/blend';
import { IDENTITY } from '@feega/motion-core/motion/affine';
import { ItemKind, displayListAt, type ImageItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { Smoothing } from '@feega/motion-core/motion/gpu-full/text/painter';
import { boxBook } from './gpu-full/text/test-face';
import { boundsOfClips, imageSources, svgOf } from './export-svg';

const boxType = { fonts: boxBook(), smoothing: Smoothing.Plain };
const FRAME = 60;

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const patch = (doc: MotionDoc, id: string, change: Partial<MotionClip>): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...change } : c)) })) });

const blank = newMotionDoc(MotionFormat.Landscape);
const square = { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1, fill: '#ff0000' };
const withCard = must(addClip(blank, { component: 'Shape', from: 0, durationInFrames: 90, props: square }, 'card'));
const cardProps = withCard.tracks.flatMap((t) => t.clips).find((c) => c.id === 'card')!.props;
const svgFor = (doc: MotionDoc, options: Partial<Parameters<typeof svgOf>[1]> = {}) => svgOf(displayListAt(doc, FRAME, FEEGA_TOKENS, boxType), { scale: 1, images: new Map(), ...options });

describe('svgOf', () => {
  it('draws a shape as a path in the frame, never as a foreign object', () => {
    const { svg } = svgFor(withCard);

    expect(svg).toContain('viewBox="0 0 1920 1080"');
    expect(svg).toContain('<path');
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).not.toContain('foreignObject');
  });

  it('scales the file without changing what is drawn', () => {
    const { svg } = svgFor(withCard, { scale: 2 });

    expect(svg).toContain('width="3840" height="2160"');
    expect(svg).toContain('viewBox="0 0 1920 1080"');
  });

  it('paints a transparent doc without a background rectangle', () => {
    const transparent = { ...withCard, background: Background.Transparent };

    expect(svgFor(transparent).svg.match(/<path/g)).toHaveLength(1);
    expect(svgFor(withCard).svg.match(/<rect/g)).toHaveLength(1);
  });

  it('keeps a gradient fill as a gradient with its stops', () => {
    const fills = [{ type: FillType.Linear, angle: 0, stops: [{ color: '#000000', pos: 0 }, { color: '#ffffff', pos: 1 }] }];
    const { svg } = svgFor(patch(withCard, 'card', { props: { ...cardProps, fills } }));

    expect(svg).toMatch(/<linearGradient id="g\d+" gradientUnits="userSpaceOnUse"/);
    expect(svg).toContain('stop-color="#000000"');
    expect(svg).toContain('stop-color="#ffffff"');
    expect(svg).toMatch(/fill="url\(#g\d+\)"/);
  });

  it('writes text as outlines, so no font is needed to open it', () => {
    const titled = must(addClip(blank, { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'ab' } }, 'title'));
    const { svg, skipped } = svgFor(titled);

    expect(svg).toContain('<path');
    expect(svg).not.toContain('<text');
    expect(skipped).toEqual([]);
  });

  it('keeps a rectangle mask as a mask', () => {
    const masked = patch(withCard, 'card', { mask: { kind: 'rect', x: 0.5, y: 0.5, width: 0.05, height: 0.05, rotation: 0, expansion: 0, feather: 0, opacity: 1, invert: false, mode: 'add', assetId: null, points: [], text: '' } } as never);
    const { svg, skipped } = svgFor(masked);

    expect(svg).toMatch(/<mask id="m\d+"/);
    expect(svg).toMatch(/mask="url\(#m\d+\)"/);
    expect(skipped).toEqual([]);
  });

  it('crops the view to a box', () => {
    const { svg } = svgFor(withCard, { crop: { left: 864, top: 486, width: 192, height: 108 }, scale: 2 });

    expect(svg).toContain('width="384" height="216"');
    expect(svg).toContain('viewBox="864 486 192 108"');
  });

  it('says what it left out, naming the element and why', () => {
    const blended = patch(withCard, 'card', { blend: BlendMode.Multiply });
    const { svg, skipped } = svgFor(blended);

    expect(svg).not.toContain('fill="#ff0000"');
    expect(skipped).toEqual(['card: blend mode multiply']);
  });

  it('says what the display list could not draw at all', () => {
    const titled = must(addClip(withCard, { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'ab' } }, 'title'));
    const noFonts = svgOf(displayListAt(titled, FRAME, FEEGA_TOKENS), { scale: 1, images: new Map() });

    expect(noFonts.skipped).toEqual(['title (Title): font']);
  });
});

describe('boundsOfClips', () => {
  it('is the box the named elements cover in frame pixels', () => {
    const list = displayListAt(withCard, FRAME, FEEGA_TOKENS, boxType);

    expect(boundsOfClips(list, new Set(['card']))).toEqual({ left: 864, top: 486, width: 192, height: 108 });
    expect(boundsOfClips(list, new Set(['nothing']))).toBeNull();
  });
});

describe('imageSources', () => {
  it('lists each picture once, so the writer can inline them', () => {
    const picture = { kind: ItemKind.Image, clip: 'a', src: 'https://x.test/p.png', video: false, mediaTime: 0, size: { width: 10, height: 10 }, fit: 'cover', focus: [0.5, 0.5], zoom: 1, clipped: true, inner: IDENTITY, opacity: 1, matrix: IDENTITY, blur: 0, blend: BlendMode.Normal } as ImageItem;
    const list = { width: 10, height: 10, background: null, unsupported: [], items: [picture, { ...picture, clip: 'b' }] };

    expect(imageSources(list)).toEqual(['https://x.test/p.png']);
  });

  it('writes the picture inline with its framing, and says when it is missing', () => {
    const picture = { kind: ItemKind.Image, clip: 'a', src: 'https://x.test/p.png', video: false, mediaTime: 0, size: { width: 10, height: 10 }, fit: 'cover', focus: [0.5, 0.5], zoom: 1, clipped: true, inner: IDENTITY, opacity: 1, matrix: IDENTITY, blur: 0, blend: BlendMode.Normal } as ImageItem;
    const list = { width: 10, height: 10, background: null, unsupported: [], items: [picture] };

    expect(svgOf(list, { scale: 1, images: new Map([[picture.src, 'data:image/png;base64,AAAA']]) }).svg).toContain('<image href="data:image/png;base64,AAAA" x="0" y="0" width="10" height="10" preserveAspectRatio="xMidYMid slice"');
    expect(svgOf(list, { scale: 1, images: new Map() }).skipped).toEqual(['a: picture not available (https://x.test/p.png)']);
  });
});
