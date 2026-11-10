import { describe, expect, it, vi } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { FullBackend } from '@feega/motion-core/motion/gpu-full/backends';

const SKIP_FROM = 2;
let drawn = 0;

vi.mock('@feega/motion-core/motion/gpu-full/backends', async (real) => ({
  ...(await real<object>()),
  BACKENDS: { core: async () => ({ draw: () => (drawn++ >= SKIP_FROM ? ['clip'] : []), dispose: () => {} }) }
}));
vi.mock('@feega/motion-core/motion/gpu-full/media', () => ({ createMedia: () => ({ ready: async () => {}, pictures: () => null, dispose: () => {} }) }));
vi.mock('$lib/motion/gpu/shared-frames', () => ({ originalFrames: () => null }));

const { renderOnCore } = await import('./core-export');

describe('a core export that stops midway', () => {
  it('reports how many frames it already handed over, so the rest resumes instead of restarting at frame 0', async () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    vi.stubGlobal('createImageBitmap', async () => ({}));
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 30 }, 'bg');
    if (!added.ok) {
      throw new Error(added.error);
    }
    const prepared = prepare(added.doc, FEEGA_TOKENS, {});
    const times = [0, 1, 2, 3].map((f) => f / added.doc.fps);
    const custom = { readAt: async () => ({ reads: new Map(), picture: () => null }), dispose: () => {} };

    const done = await renderOnCore(prepared, FullBackend.Core, times, async () => {}, new AbortController().signal, custom as never);

    expect(done).toBe(SKIP_FROM);
  });
});
