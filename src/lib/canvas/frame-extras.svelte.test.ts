import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { newMotionDoc, MotionFormat } from '@feega/motion-core/motion/doc';

const loadPageData = vi.fn();
vi.mock('$lib/api/page-action', () => ({ loadPageData: (url: URL) => loadPageData(url), postPageAction: vi.fn() }));

const { FrameExtras } = await import('./frame-extras.svelte');

const AT = { projectId: 'p', canvasId: 'c', nodeId: 'copy' };
const LOADED = { fonts: [], assets: [], orgId: 'o', gallery: { remixOf: null } };

function extrasLanding(landed: Promise<boolean>) {
  return new FrameExtras(AT, {} as SupabaseClient, () => newMotionDoc(MotionFormat.Landscape), landed);
}

describe('the editor extras of a frame shown before the server wrote it', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { origin: 'https://feega.test' });
    loadPageData.mockReset();
    loadPageData.mockResolvedValue(LOADED);
  });

  it('a duplicate or a drawn frame asks for its editor data only once its row has landed', async () => {
    let land: (landed: boolean) => void = () => {};
    const extras = extrasLanding(new Promise((resolve) => (land = resolve)));

    const loading = extras.load();
    await Promise.resolve();
    expect(loadPageData).not.toHaveBeenCalled();

    land(true);
    await loading;
    expect(loadPageData).toHaveBeenCalledTimes(1);
    expect(extras.data).toEqual(LOADED);
  });

  it('a copy the server refused never asks, and never rejects', async () => {
    const extras = extrasLanding(Promise.resolve(false));

    await expect(extras.load()).resolves.toBeUndefined();
    expect(loadPageData).not.toHaveBeenCalled();
    expect(extras.data).toBeNull();
  });
});
