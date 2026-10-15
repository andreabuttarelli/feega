import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { savePoster } from './poster';

const NODE = '44444444-4444-4444-4444-444444444444';

function save(file: File) {
  const fake = fakeDb({ nodes: [{ id: NODE, org_id: 'org', type: 'motion', data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null }, version: 1 }] }, { filter: true, newId: () => '99999999-9999-4999-8999-999999999999' });
  const form = new FormData();
  form.set('file', file);
  return { fake, result: savePoster(fake.db, { orgId: 'org', projectId: 'project', nodeId: NODE, actor: { kind: 'user', id: 'user' }, form }) };
}

describe('a poster upload', () => {
  it('keeps a png as png, so a see-through element stays see-through', async () => {
    const { fake, result } = save(new File([new Uint8Array([1, 2, 3])], 'poster.png', { type: 'image/png' }));

    expect(await result).toMatchObject({ assetId: expect.any(String) });
    const upload = fake.calls.find((c) => c.op === 'upload');
    expect(String(upload?.filters[0]?.[1])).toMatch(/\.png$/);
    expect(fake.calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload).toMatchObject({ mime_type: 'image/png' });
  });

  it('refuses anything that is not a jpeg or png picture', async () => {
    const { result } = save(new File([new Uint8Array([1])], 'x.gif', { type: 'image/gif' }));

    expect(await result).toMatchObject({ status: 400 });
  });
});
