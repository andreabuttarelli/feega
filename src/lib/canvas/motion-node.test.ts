import { describe, expect, it } from 'vitest';
import { MotionFormat } from '$lib/motion/doc';
import { motionEditorPath, motionOf, newMotionData } from './motion-node';

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
});
