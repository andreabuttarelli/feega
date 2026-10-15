import { describe, expect, it } from 'vitest';
import { FORMATS, MOTION_FORMATS, MotionFormat } from '$lib/motion/doc';
import { FrameKind, MOTION_NODE_BAR_H, elementNodeOf, openingSelection, tileChromeOf, frameNodeOf, frameNodeSize, motionEditorPath, motionNodeSize, motionOf, motionPreviewPath, newMotionData, storyboardPath } from './motion-node';
import { NodeMode } from './inline-motion';
import { nodeSize } from './node-size';

describe('motion node', () => {
  it('a new motion node is vertical with no revision yet', () => {
    expect(motionOf({ id: 'n', type: 'motion', data: newMotionData() })).toEqual({
      id: 'n',
      format: MotionFormat.Vertical,
      docHeadRevision: 0,
      posterAssetId: null,
      lastRenderAssetId: null,
      kind: FrameKind.Frame
    });
  });

  it('another type is not a motion node', () => {
    expect(motionOf({ id: 'n', type: 'video', data: {} })).toBeNull();
  });

  it('a broken payload falls back to a usable node', () => {
    expect(motionOf({ id: 'n', type: 'motion', data: { format: 'cinema' } })?.format).toBe(MotionFormat.Vertical);
  });

  it.each([
    ['landscape', MotionFormat.Landscape],
    ['vertical', MotionFormat.Vertical],
    ['square', MotionFormat.Square],
    ['portrait', MotionFormat.Portrait]
  ])('a node written with the format name %s opens in that format, not as 9:16', (name, format) => {
    const node = motionOf({ id: 'n', type: 'motion', data: { format: name, docHeadRevision: 3, posterAssetId: null, lastRenderAssetId: null } });

    expect(node?.format).toBe(format);
    expect(node?.docHeadRevision).toBe(3);
  });

  it('the editor lives under the canvas', () => {
    expect(motionEditorPath({ projectId: 'p', canvasId: 'c', nodeId: 'n' })).toBe('/p/p/c/c/motion/n');
  });

  it.each(MOTION_FORMATS)('a %s node is its picture plus the bar, so the selection frames what is visible', (format) => {
    const { w, h } = motionNodeSize(format);
    const { width, height } = FORMATS[format];

    expect((h - MOTION_NODE_BAR_H) / w).toBeCloseTo(height / width, 2);
  });

  it('the canvas sizes a motion node by the format it carries', () => {
    const wide = nodeSize('motion', newMotionData(MotionFormat.Landscape));
    const tall = nodeSize('motion', newMotionData(MotionFormat.Vertical));

    expect(wide.w).toBeGreaterThan(wide.h);
    expect(tall.h).toBeGreaterThan(tall.w);
    expect(nodeSize('motion')).toEqual(motionNodeSize(MotionFormat.Vertical));
  });

  it('the preview is read next to the editor', () => {
    expect(motionPreviewPath({ projectId: 'p', canvasId: 'c', nodeId: 'n' })).toBe('/p/p/c/c/motion/n/preview');
  });
});

describe('the storyboard of a video', () => {
  it('opens the canvas linked on the motion node, or nothing before the agent writes one', () => {
    expect(storyboardPath('p', { storyboard: { canvasId: 'board', placed: [] } })).toBe('/p/p/c/board');
    expect(storyboardPath('p', {})).toBeNull();
    expect(storyboardPath('p', { storyboard: { canvasId: '' } })).toBeNull();
  });
});

describe('a frame node follows the shape of its graphic', () => {
  it('keeps its width and takes the height of the picture plus the bar', () => {
    expect(frameNodeSize(400, { width: 1080, height: 1350 })).toEqual({ w: 400, h: 500 + MOTION_NODE_BAR_H });
    expect(frameNodeSize(420, { width: 1920, height: 1080 })).toEqual({ w: 420, h: 236 + MOTION_NODE_BAR_H });
  });

  it('a new frame made from an element takes the element shape, not a 16:9 box', () => {
    const made = frameNodeOf({ width: 1536, height: 432 });

    expect(made.data.format).toBe('16:9');
    expect(made.h - MOTION_NODE_BAR_H).toBe(Math.round((made.w * 432) / 1536));
  });

  it('a resize keeps the width the hand chose and fixes the height to the picture', () => {
    expect(frameNodeSize(300.4, { width: 1080, height: 1920 })).toEqual({ w: 300, h: 533 + MOTION_NODE_BAR_H });
  });

  it('while edited it is only the picture: no bar under it', () => {
    expect(frameNodeSize(420, { width: 1920, height: 1080 }, NodeMode.Edit)).toEqual({ w: 420, h: 236 });
    expect(frameNodeSize(420, { width: 1920, height: 1080 }, NodeMode.Preview)).toEqual({ w: 420, h: 236 + MOTION_NODE_BAR_H });
  });
});

describe('a free element is a frame without chrome', () => {
  it('is the drawn box exactly: no bar, in preview or edit', () => {
    const made = elementNodeOf({ width: 240, height: 80 });

    expect(made.data.kind).toBe(FrameKind.Element);
    expect({ w: made.w, h: made.h }).toEqual({ w: 240, h: 80 });
    expect(frameNodeSize(120, { width: 480, height: 160 }, NodeMode.Preview, FrameKind.Element)).toEqual({ w: 120, h: 40 });
  });

  it('has no ports, no name tag and a small minimum size: it is a shape, not a node', () => {
    const element = { id: 'e', type: 'motion', data: elementNodeOf({ width: 10, height: 10 }).data };

    expect(tileChromeOf(element)).toMatchObject({ ports: false, label: false, bar: false, takesDrops: false });
    expect(tileChromeOf({ id: 'f', type: 'motion', data: newMotionData() })).toMatchObject({ ports: true, label: true, bar: true });
    expect(tileChromeOf({ id: 't', type: 'text', data: {} })).toMatchObject({ ports: true, label: true });
    expect(nodeSize('motion', element.data).w).toBeLessThan(40);
  });

  it('opens with its own shapes selected, so the properties show at once; a frame opens on nothing', () => {
    expect(openingSelection(FrameKind.Element, ['a', 'b'])).toEqual(['a', 'b']);
    expect(openingSelection(FrameKind.Frame, ['a', 'b'])).toEqual([]);
  });

  it('reads back as an element; an old frame without the field stays a frame', () => {
    expect(motionOf({ id: 'e', type: 'motion', data: elementNodeOf({ width: 10, height: 10 }).data })?.kind).toBe(FrameKind.Element);
    expect(motionOf({ id: 'f', type: 'motion', data: { format: '9:16', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } })?.kind).toBe(FrameKind.Frame);
  });
});
