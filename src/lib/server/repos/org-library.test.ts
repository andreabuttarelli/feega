import { describe, expect, it } from 'vitest';
import { fakeDb, filtersOf } from '$lib/server/db/fake-db';
import { saveToOrgLibrary } from './org-library';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const ASSET = '33333333-3333-3333-3333-333333333333';

const projectAsset = {
  id: ASSET,
  org_id: ORG,
  project_id: PROJECT,
  type: 'image',
  url: 'org/project/a.png',
  content: null,
  mime_type: 'image/png',
  bytes: 10,
  width: 4,
  height: 4,
  duration_s: null,
  source: 'upload',
  source_node_id: '44444444-4444-4444-4444-444444444444',
  uncensored: false,
  created_at: '2026-10-01T00:00:00Z'
};

describe('salvare nella libreria dell org', () => {
  it('copia l asset senza progetto e senza nodo di origine', async () => {
    const { db, calls } = fakeDb({ assets: [projectAsset] }, { filter: true, store: true });

    const saved = await saveToOrgLibrary(db, { orgId: ORG, assetId: ASSET });

    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.payload).toMatchObject({ org_id: ORG, project_id: null, source_node_id: null, url: 'org/project/a.png', type: 'image' });
    expect(saved).toMatchObject({ projectId: null });
  });

  it('un asset già nella libreria con lo stesso file non si duplica', async () => {
    const inLibrary = { ...projectAsset, id: 'library-row', project_id: null, source_node_id: null };
    const { db, calls } = fakeDb({ assets: [projectAsset, inLibrary] }, { filter: true });

    const saved = await saveToOrgLibrary(db, { orgId: ORG, assetId: ASSET });

    expect(calls.some((c) => c.op === 'insert')).toBe(false);
    expect(saved?.id).toBe('library-row');
  });

  it('un asset di un altra org non esiste per chi chiede', async () => {
    const { db, calls } = fakeDb({ assets: [projectAsset] }, { filter: true });

    const saved = await saveToOrgLibrary(db, { orgId: 'other-org', assetId: ASSET });

    expect(saved).toBeNull();
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
    expect(filtersOf(calls, 'select')).toMatchObject({ org_id: 'other-org' });
  });

  it('un asset già della libreria torna com è', async () => {
    const inLibrary = { ...projectAsset, project_id: null };
    const { db, calls } = fakeDb({ assets: [inLibrary] }, { filter: true });

    const saved = await saveToOrgLibrary(db, { orgId: ORG, assetId: ASSET });

    expect(calls.some((c) => c.op === 'insert')).toBe(false);
    expect(saved?.id).toBe(ASSET);
  });
});
