import { describe, expect, it } from 'vitest';
import { ResizeMode, customSize, fitElementToNode, fitToNode, frameSizeNote, handResized } from './custom-size';
import { Horizontal, Vertical } from '@feega/motion-core/motion/constraints/model';
import { DESIGN_MAX_SIDE, MAX_SHORT_SIDE, MAX_SIDE, MotionFormat, formatOf, newMotionDoc, motionDocSchema, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setCanvas } from '@feega/motion-core/motion/timeline';

const ratio = (s: { width: number; height: number }) => s.width / s.height;

describe('customSize', () => {
  it('keeps the node pixels when a video fits', () => {
    expect(customSize({ width: 500, height: 300 })).toEqual({ width: 500, height: 300 });
  });

  it('a video frame takes a tall page, as a design does: the video limits wait for the export', () => {
    expect(customSize({ width: 1440, height: 5000 })).toEqual({ width: 1440, height: 5000 });
    expect(motionDocSchema.safeParse({ ...newMotionDoc(MotionFormat.Landscape), width: 1440, height: 5000 }).success).toBe(true);
  });

  it('keeps the aspect when a side is over the frame limit', () => {
    const size = customSize({ width: 32000, height: 2000 });

    expect(size.width).toBe(DESIGN_MAX_SIDE);
    expect(Math.abs(ratio(size) - 16)).toBeLessThan(0.01);
  });

  it('says when the asked size was over the frame limit', () => {
    expect(frameSizeNote({ width: 1440, height: 20000 })).toContain(`${DESIGN_MAX_SIDE}`);
    expect(frameSizeNote({ width: 1440, height: 9000 })).toBeNull();
  });

  it('gives even sides the doc accepts', () => {
    const size = customSize({ width: 333, height: 211 });

    expect([size.width % 2, size.height % 2]).toEqual([0, 0]);
    expect(motionDocSchema.safeParse({ ...newMotionDoc(MotionFormat.Landscape), ...size }).success).toBe(true);
  });

  it('never goes under the doc minimum on a sliver', () => {
    expect(customSize({ width: 2000, height: 4 }).height).toBeGreaterThanOrEqual(16);
  });

  it('gives a still the exact pixels, any ratio', () => {
    expect(customSize({ width: 333, height: 2111 }, { still: { frame: 0 } })).toEqual({ width: 333, height: 2111 });
  });
});

describe('custom format', () => {
  it('picking custom keeps the current size', () => {
    const result = setCanvas(newMotionDoc(MotionFormat.Vertical), { format: MotionFormat.Custom });

    expect(result.ok && [result.doc.width, result.doc.height, formatOf(result.doc)]).toEqual([1080, 1920, MotionFormat.Custom]);
  });

  it('a custom size sets width and height and stays custom', () => {
    const result = setCanvas(newMotionDoc(MotionFormat.Landscape), { size: { width: 1200, height: 900 } });

    expect(result.ok && [result.doc.width, result.doc.height, formatOf(result.doc)]).toEqual([1200, 900, MotionFormat.Custom]);
  });

  it('a preset leaves custom', () => {
    const custom = setCanvas(newMotionDoc(MotionFormat.Landscape), { format: MotionFormat.Custom });
    const back = custom.ok ? setCanvas(custom.doc, { format: MotionFormat.Square }) : custom;

    expect(back.ok && formatOf(back.doc)).toBe(MotionFormat.Square);
  });

  it('refuses a size above the frame limit', () => {
    expect(setCanvas(newMotionDoc(MotionFormat.Landscape), { size: { width: DESIGN_MAX_SIDE + 2, height: 3840 } }).ok).toBe(false);
  });
});

describe('fitElementToNode', () => {
  it('stretches a pinned shape with its element node, so the shape keeps filling it', () => {
    const base = newMotionDoc(MotionFormat.Landscape);
    const shape = { id: 's', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 }, transform: {}, keyframes: {}, constraints: { horizontal: Horizontal.Left, vertical: Vertical.Top } };
    const doc = { ...base, width: 200, height: 100, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape] }] } as unknown as MotionDoc;

    const sized = fitElementToNode(doc, { width: 300, height: 100 });

    expect(sized.ok && sized.doc.tracks[0].clips[0].props).toMatchObject({ x: 0.5, width: 1 });
    expect(sized.ok && sized.doc.tracks[0].clips[0].constraints).toEqual(shape.constraints);
  });
});

describe('resizing a free element', () => {
  it('a free text that grows down keeps filling its node at the same type size', () => {
    const base = newMotionDoc(MotionFormat.Landscape);
    const text = { id: 't', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'Hi', x: 0.5, y: 0.5, width: 1, height: 1, size: 0.75, sizing: 'auto-height' }, transform: {}, keyframes: {} };
    const doc = { ...base, still: true, width: 240, height: 80, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [text] }] } as unknown as MotionDoc;

    const sized = fitToNode(doc, { width: 240, height: 320 }, ResizeMode.Element);

    expect(sized.ok && sized.doc.tracks[0].clips[0].props).toMatchObject({ x: 0.5, y: 0.5, width: 1, height: 1, size: 0.25 });
  });
});

describe('resizing a free text by hand', () => {
  const base = newMotionDoc(MotionFormat.Landscape);
  const autoWidth = (() => {
    const text = { id: 't', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'Hi', x: 0.5, y: 0.5, width: 1, height: 1, size: 0.75, sizing: 'auto' }, transform: {}, keyframes: {} };
    return { ...base, still: true, width: 240, height: 80, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [text] }] } as unknown as MotionDoc;
  })();

  it('dragging its width stops it hugging the width, so the new width sticks', () => {
    const sized = handResized(autoWidth, { width: 240, height: 80 }, { width: 400, height: 80 });

    expect(sized.ok && sized.doc.tracks[0].clips[0].props).toMatchObject({ sizing: 'auto-height', width: 1 });
    expect(sized.ok && sized.doc.width).toBe(400);
  });

  it('dragging its height fixes both sides', () => {
    const sized = handResized(autoWidth, { width: 240, height: 80 }, { width: 240, height: 160 });

    expect(sized.ok && sized.doc.tracks[0].clips[0].props.sizing).toBe('fixed');
  });
});

describe('resizing a frame while ignoring constraints', () => {
  const scaled = () => {
    const base = newMotionDoc(MotionFormat.Landscape);
    const card = { id: 'card', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.25, y: 0.5, width: 0.25, height: 0.5 }, transform: {}, keyframes: {} };
    return { ...base, width: 400, height: 200, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [card] }] } as unknown as MotionDoc;
  };
  const widthPx = (doc: MotionDoc) => Number(doc.tracks[0].clips[0].props.width) * doc.width;

  it('a layer that scales with the frame grows with it by default', () => {
    const sized = fitToNode(scaled(), { width: 800, height: 200 });

    expect(sized.ok && widthPx(sized.doc)).toBeCloseTo(200);
  });

  it('ignoring constraints keeps the layer at its pixel size and place', () => {
    const sized = fitToNode(scaled(), { width: 800, height: 200 }, ResizeMode.Ignored);

    expect(sized.ok && widthPx(sized.doc)).toBeCloseTo(100);
    expect(sized.ok && Number(sized.doc.tracks[0].clips[0].props.x) * 800).toBeCloseTo(100);
  });

  it('leaves the constraints of the layer as they were', () => {
    const own = { horizontal: Horizontal.Right, vertical: Vertical.Bottom };
    const doc = scaled();
    const pinned = { ...doc, tracks: [{ ...doc.tracks[0], clips: [{ ...doc.tracks[0].clips[0], constraints: own }] }] } as MotionDoc;
    const sized = fitToNode(pinned, { width: 800, height: 200 }, ResizeMode.Ignored);

    expect(sized.ok && sized.doc.tracks[0].clips[0].constraints).toEqual(own);
  });
});

describe('resizing a still frame', () => {
  const page = () => {
    const base = newMotionDoc(MotionFormat.Landscape);
    const row = { id: 'row', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 0.5 }, autoLayout: { direction: 'horizontal', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 } }, transform: {}, keyframes: {} };
    const card = { id: 'card', parent: 'row', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.125, y: 0.5, width: 0.25, height: 0.5 }, transform: {}, keyframes: {} };
    const title = { id: 'title', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'Hi', x: 0.25, y: 0.1, width: 0.5, height: 0.1, size: 0.05 }, transform: {}, keyframes: {}, constraints: { horizontal: Horizontal.Left, vertical: Vertical.Top } };
    return { ...base, still: { frame: 0 }, width: 1280, height: 800, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [row, card, title] }] } as unknown as MotionDoc;
  };
  const clip = (doc: MotionDoc, id: string) => doc.tracks[0].clips.find((c) => c.id === id)!;

  it('keeps type size and the pixel width of laid-out children, as a page does in a narrower window', () => {
    const sized = fitToNode(page(), { width: 768, height: 800 });
    const doc = sized.ok ? sized.doc : page();

    expect(Number(clip(doc, 'title').props.size) * Math.min(doc.width, doc.height)).toBeCloseTo(40);
    expect(Number(clip(doc, 'card').props.width) * doc.width).toBeCloseTo(320);
    expect(Number(clip(doc, 'row').props.width) * doc.width).toBeCloseTo(768);
  });
});

describe('resizing a frame keeps what is inside it, as in Figma', () => {
  const ok = (r: ReturnType<typeof fitToNode>): MotionDoc => {
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  };
  const pinned = { horizontal: Horizontal.Left, vertical: Vertical.Top };
  const screen = (width: number, height: number, still = true): MotionDoc => {
    const base = { ...newMotionDoc(MotionFormat.Custom), width, height, freeSize: true, ...(still ? { still: { frame: 0 } } : {}) } as MotionDoc;
    const card = ok(addClip(base, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.5, y: 0.25, width: 0.5, height: 0.1, roundness: 0.2 }, constraints: pinned }, 'card'));
    return ok(addClip(card, { component: 'Title', from: 0, props: { text: 'Hi', x: 0.5, y: 0.5, size: 0.04 }, constraints: pinned }, 'title'));
  };
  const clip = (doc: MotionDoc, id: string) => doc.tracks.flatMap((t) => t.clips).find((c) => c.id === id)!.props as Record<string, number>;
  const pxBox = (doc: MotionDoc, id: string) => ({ w: clip(doc, id).width * doc.width, h: clip(doc, id).height * doc.height });
  const radiusPx = (doc: MotionDoc, id: string) => clip(doc, id).roundness * Math.min(pxBox(doc, id).w, pxBox(doc, id).h);

  it('a frame held at two doc px per canvas px stays at two: 390×844 on canvas to 390×1100', () => {
    const doc = screen(780, 1688);
    const sized = ok(fitToNode(doc, { width: 390, height: 1100 }, ResizeMode.Constrained, { width: 390, height: 844 }));

    expect([sized.width, sized.height]).toEqual([780, 2200]);
  });

  it('a taller frame keeps its layers in px: box, type size and radius', () => {
    const doc = screen(390, 844);
    const sized = ok(fitToNode(doc, { width: 390, height: 1100 }, ResizeMode.Constrained, { width: 390, height: 844 }));

    expect(pxBox(sized, 'card').h).toBeCloseTo(pxBox(doc, 'card').h, 3);
    expect(clip(sized, 'title').size * Math.min(sized.width, sized.height)).toBeCloseTo(clip(doc, 'title').size * 390, 3);
    expect(radiusPx(sized, 'card')).toBeCloseTo(radiusPx(doc, 'card'), 3);
  });

  it('a stretched layer keeps its radius in px', () => {
    const doc = screen(342, 52);
    const wide = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'card' ? { ...c, props: { ...c.props, x: 0.5, y: 0.5, width: 1, height: 1, roundness: 12 / 52 }, constraints: { horizontal: Horizontal.LeftRight, vertical: Vertical.TopBottom } } : c)) })) } as MotionDoc;
    const sized = ok(fitToNode(wide, { width: 400, height: 900 }, ResizeMode.Constrained, { width: 342, height: 52 }));

    expect(radiusPx(sized, 'card')).toBeCloseTo(12, 3);
  });

  it('a video frame keeps its type size in px too', () => {
    const doc = screen(1000, 600, false);
    const sized = ok(fitToNode(doc, { width: 1000, height: 400 }, ResizeMode.Constrained, { width: 1000, height: 600 }));

    expect(clip(sized, 'title').size * Math.min(sized.width, sized.height)).toBeCloseTo(0.04 * 600, 3);
  });
});
