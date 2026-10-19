import { describe, expect, it } from 'vitest';
import { Unsupported, type Gap } from '$lib/motion/gpu-full/display-list';
import { histogram } from './histogram';

const gap = (reason: Unsupported, component = 'Shape', detail?: string): Gap => ({ clip: 'c', component: component as Gap['component'], reason, ...(detail ? { detail } : {}) });

describe('histogram', () => {
  it('counts gaps and the frames each reason keeps on a poster', () => {
    const rows = histogram([
      { id: 'a', gaps: [gap(Unsupported.Stroke), gap(Unsupported.Stroke)] },
      { id: 'b', gaps: [gap(Unsupported.Stroke), gap(Unsupported.Mask)] },
      { id: 'c', gaps: [] }
    ]);
    expect(rows).toEqual([
      { reason: 'stroke', gaps: 3, frames: 2, only: 1 },
      { reason: 'mask', gaps: 1, frames: 1, only: 0 }
    ]);
  });

  it('files every gap of a custom component under custom', () => {
    const rows = histogram([{ id: 'a', gaps: [gap(Unsupported.Unread, 'Custom'), gap(Unsupported.Dom, 'Custom', 'svg path ×2')] }]);
    expect(rows).toEqual([{ reason: 'custom', gaps: 2, frames: 1, only: 1 }]);
  });
});
