import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip } from '$lib/motion/doc';
import { flattenComps } from '$lib/motion/precomp';
import { sequenceScenes } from '$lib/motion/scenes';
import { playedDoc } from './selection-export-ports';
import type { FrameStore } from './move-element';

const A = '11111111-1111-4111-8111-111111111111';

const scene = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 30 };
const store = { read: async (id: string) => (id === A ? { doc: scene } : null) } as unknown as FrameStore;
const parent = sequenceScenes(newMotionDoc(MotionFormat.Landscape), [{ nodeId: A, durationInFrames: 30 }]);

describe('a sequence frame exported on the server', () => {
  it('embeds its scenes before it is drawn, so the export is not empty', async () => {
    const played = await playedDoc(store, parent);

    expect(Object.keys(played.comps)).toHaveLength(1);
    expect(flattenComps(played).tracks.flatMap((t) => t.clips as MotionClip[]).some((c) => c.component === 'Precomp')).toBe(true);
  });

  it('leaves an ordinary frame as it is', async () => {
    expect(await playedDoc(store, scene)).toBe(scene);
  });
});
