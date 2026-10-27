import { afterEach, describe, expect, it, vi } from 'vitest';

const billedRows: Record<string, unknown>[] = [];

vi.mock('$env/dynamic/private', () => ({ env: { SCRAPECREATORS_API_KEY: 'key' } }));
vi.mock('$lib/server/canvas-catalogue', () => {
  const nothing = { choices: [], recommended: [], synced: true };
  return { canvasModelCatalogue: async () => ({ text: nothing, image: nothing, video: nothing }) };
});
vi.mock('$lib/server/cli-auth', () => ({ gateOrgAiActionForForm: async () => null }));
vi.mock('$lib/server/repos/social-posts', () => ({ upsertNodeSocialPosts: async () => 1 }));
vi.mock('$lib/server/media-archive', () => ({
  archiveImageToBucket: async () => null,
  archiveVideoToBucket: async () => null
}));
vi.mock('$lib/server/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table === 'ai_calls') {
          billedRows.push(row);
        }
        return { select: () => ({ single: async () => ({ data: { id: 'call' }, error: null }) }) };
      }
    })
  })
}));

import { actions } from '../../../routes/p/[projectId]/c/[canvasId]/+page.server';
import { fakeDb } from '$lib/server/db/fake-db';

const ORG = 'org';
const NODE = 'feed';

function syncEvent() {
  const fake = fakeDb(
    {
      orgs_members: [{ role: 'owner', orgs: { id: ORG, name: 'Org', slug: 'org' } }],
      canvases: [{ id: 'canvas', project_id: 'project', name: 'Canvas', viewport: null }],
      nodes: [{ id: NODE, org_id: ORG, type: 'social_account_feed', version: 1, data: { platform: 'x', handle: 'someone' } }]
    },
    { updateRows: { nodes: [{ id: NODE, version: 2, data: {} }] } }
  );
  const body = new FormData();
  body.set('node_id', NODE);
  body.set('version', '1');
  return {
    ...fake,
    request: new Request('http://localhost/c/canvas', { method: 'POST', body }),
    params: { canvasId: 'canvas' },
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user' } }), db: async () => fake.db }
  };
}

afterEach(() => {
  billedRows.length = 0;
  vi.unstubAllGlobals();
});

describe('canvas sync action without a brand', () => {
  it('bills the scrape to the org', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ tweets: [] }), { status: 200 }));

    await actions.sync(syncEvent() as never);
    await vi.waitFor(() => expect(billedRows.length).toBeGreaterThan(0));

    expect(billedRows[0]).toMatchObject({ org_id: ORG, provider: 'scrapecreators' });
  });
});
