import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { newMotionDoc, MotionFormat } from '@feega/motion-core/motion/doc';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { WATERMARK_TEXT } from '@feega/motion-core/motion/watermark';
import { Preset, settingsOf } from '$lib/motion/export-formats';
import type { RenderRequest } from './render-run';

const sent = vi.hoisted(() => ({ requests: [] as RenderRequest[] }));

vi.mock('$lib/motion/server-render', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/motion/server-render')>()), serverRenderOpen: () => true }));
vi.mock('./renderer', () => ({ motionRenderFarm: () => ({}), motionRenderStorage: () => ({}) }));
vi.mock('./editor', async (importOriginal) => ({ ...(await importOriginal<typeof import('./editor')>()), motionAssets: async () => [], motionTokens: async () => FEEGA_TOKENS }));
vi.mock('./audio-analysis', async (importOriginal) => ({ ...(await importOriginal<typeof import('./audio-analysis')>()), analyzeSounds: async () => ({}), storageAnalysis: () => ({}) }));
vi.mock('./render-run', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./render-run')>()),
  startRender: async (_db: unknown, _farm: unknown, _scope: unknown, req: RenderRequest) => {
    sent.requests.push(req);
    return { ok: true };
  }
}));

const { startFarmRender } = await import('./render-start');

const head = { version: 3, doc: newMotionDoc(MotionFormat.Landscape) };
const scope = { orgId: 'org-1', projectId: 'p1', canvasId: 'c1', nodeId: 'n1', userId: 'u1', brandId: null, editorUrl: '/e' };

describe('a server render', () => {
  it('draws the watermark for a free org', async () => {
    sent.requests.length = 0;
    const { db } = fakeDb({ orgs: [{ id: 'org-1', stripe_subscription_id: null }] }, { filter: true });

    await startFarmRender(db, { ...scope, head, settings: settingsOf(Preset.Social) });

    expect(sent.requests[0].job.html).toContain(WATERMARK_TEXT);
  });

  it('is clean for a paid org', async () => {
    sent.requests.length = 0;
    const { db } = fakeDb({ orgs: [{ id: 'org-1', stripe_subscription_id: 'sub_1' }] }, { filter: true });

    await startFarmRender(db, { ...scope, head, settings: settingsOf(Preset.Social) });

    expect(sent.requests[0].job.html).not.toContain(WATERMARK_TEXT);
  });
});
