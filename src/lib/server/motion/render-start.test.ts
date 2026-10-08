import { describe, expect, it, vi } from 'vitest';
import { newMotionDoc, MotionFormat } from '$lib/motion/doc';
import { Preset, settingsOf } from '$lib/motion/export-formats';
import { SERVER_RENDER_UNAVAILABLE } from '$lib/motion/server-render';
import { RenderRefusal } from './render-run';

const touched = vi.hoisted(() => ({ farm: 0 }));

vi.mock('./renderer', () => ({
  motionRenderFarm: () => {
    touched.farm += 1;
    return {};
  },
  motionRenderStorage: () => ({ host: 'h', limit: async () => 0 })
}));

const { startFarmBatch, startFarmRender } = await import('./render-start');

const head = { version: 3, doc: newMotionDoc(MotionFormat.Landscape) };
const scope = { orgId: 'org-1', projectId: 'p1', canvasId: 'c1', nodeId: 'n1', userId: 'u1', brandId: null, editorUrl: '/e' };
const closed = { ok: false, error: RenderRefusal.Closed, detail: SERVER_RENDER_UNAVAILABLE };

describe('server rendering is closed for everyone', () => {
  it('a single render is refused before the farm is reached', async () => {
    expect(await startFarmRender({} as never, { ...scope, head, settings: settingsOf(Preset.Social) })).toEqual(closed);
    expect(touched.farm).toBe(0);
  });

  it('a batch is refused before the farm is reached', async () => {
    expect(await startFarmBatch({} as never, { orgId: 'org-1', projectId: 'p1', nodeId: 'n1', userId: 'u1', editorUrl: '/e' }, [])).toEqual(closed);
    expect(touched.farm).toBe(0);
  });
});
