import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { assetsById, motionAssets } from './editor';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';

const asset = (id: string, type: string, mime: string, at: string) => ({
  id,
  org_id: ORG,
  project_id: PROJECT,
  type,
  url: `${ORG}/${id}`,
  content: null,
  mime_type: mime,
  bytes: 1,
  width: null,
  height: null,
  duration_s: null,
  source: 'upload',
  source_node_id: null,
  uncensored: false,
  created_at: at
});

describe('motionAssets — the library a frame can use', () => {
  it('lists media and fonts newest first and leaves text documents out', async () => {
    const { db, calls } = fakeDb(
      {
        assets: [
          asset('image-new', 'image', 'image/png', '2026-10-03T00:00:00Z'),
          asset('notes', 'document', 'text/markdown', '2026-10-02T00:00:00Z'),
          asset('font-old', 'document', 'font/woff2', '2026-10-01T00:00:00Z')
        ]
      },
      { filter: true }
    );

    const assets = await motionAssets({ db, orgId: ORG, projectId: PROJECT, canvasId: 'c', sign: async () => new Map() });

    expect(assets.map((a) => a.id)).toEqual(['image-new', 'font-old']);
    expect(calls.filter((c) => c.table === 'assets').every((c) => c.limit !== undefined)).toBe(true);
  });

  it('carries the org fonts uploaded outside this project, named by family, to every render', async () => {
    const orgFont = { ...asset('org-font', 'document', 'font/woff2', '2026-10-04T00:00:00Z'), project_id: null, url: `${ORG}/fonts/acme.woff2`, content: JSON.stringify({ family: 'Acme Grotesk', weight: 700, italic: false }) };
    const otherProject = { ...asset('far-font', 'document', 'font/ttf', '2026-10-05T00:00:00Z'), project_id: 'elsewhere' };
    const { db } = fakeDb({ assets: [asset('image-new', 'image', 'image/png', '2026-10-03T00:00:00Z'), orgFont, otherProject] }, { filter: true });
    const sign = async (paths: { uploaded: string[] }) => new Map(paths.uploaded.map((p) => [p, `signed:${p}`]));

    const assets = await motionAssets({ db, orgId: ORG, projectId: PROJECT, canvasId: 'c', sign });
    const urls = await assetsById({ db, orgId: ORG, projectId: PROJECT, canvasId: 'c', sign }, ['org-font', 'far-font']);

    expect(assets.map((a) => a.id)).toEqual(['far-font', 'org-font', 'image-new']);
    expect(assets.find((a) => a.id === 'org-font')?.label).toBe('Acme Grotesk 700');
    expect(urls).toEqual({ 'org-font': `signed:${ORG}/fonts/acme.woff2`, 'far-font': `signed:${ORG}/far-font` });
  });
});
