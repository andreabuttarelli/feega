import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enterSelected } from './enter-frame';
import { frameDrill } from './frame-drill';

describe('enterSelected', () => {
  const request = vi.spyOn(frameDrill, 'request');

  beforeEach(() => {
    request.mockClear();
  });

  it('enters a motion node whatever its data.kind says', () => {
    const summaries = new Map([['n1', { type: 'motion', data: { kind: 'frame' } }]]);

    enterSelected(['n1'], summaries);

    expect(request).toHaveBeenCalledOnce();
  });

  it('skips a node whose data.kind is motion but whose type is not', () => {
    const summaries = new Map([['n1', { type: 'text', data: { kind: 'motion' } }]]);

    enterSelected(['n1'], summaries);

    expect(request).not.toHaveBeenCalled();
  });
});
