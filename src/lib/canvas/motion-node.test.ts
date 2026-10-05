import { describe, expect, it } from 'vitest';
import { FORMATS, MOTION_FORMATS, MotionFormat } from '$lib/motion/doc';
import { MOTION_NODE_BAR_H, motionEditorPath, motionNodeSize, motionOf, motionPreviewPath, newMotionData } from './motion-node';
import { nodeSize } from './node-size';

describe('motion node', () => {
  it('a new motion node is vertical with no revision yet', () => {
    expect(motionOf({ id: 'n', type: 'motion', data: newMotionData() })).toEqual({
      id: 'n',
      format: MotionFormat.Vertical,
      docHeadRevision: 0,
      posterAssetId: null,
      lastRenderAssetId: null
    });
  });

  it('another type is not a motion node', () => {
    expect(motionOf({ id: 'n', type: 'video', data: {} })).toBeNull();
  });

  it('a broken payload falls back to a usable node', () => {
    expect(motionOf({ id: 'n', type: 'motion', data: { format: 'cinema' } })?.format).toBe(MotionFormat.Vertical);
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
