import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { referenceLibrary } from './reference-library';

const asset = (id: string, type: string) => ({ id, project_id: 'p1', type, url: `o/p1/${id}`, content: null, mime_type: null, bytes: null, width: null, height: null, duration_s: null, source: 'upload', source_node_id: null, created_at: 'now' });

describe('reference library', () => {
  it('porta il catalogo globale firmato e solo le immagini del progetto', async () => {
    const { db } = fakeDb({
      reference_images: [{ id: 'c1', org_id: null, name: 'Sphere', storage_path: 'catalogue/s.png', mime_type: 'image/png', width: null, height: null, sort_order: 0 }],
      assets: [asset('a1', 'image'), asset('a2', 'video')]
    });

    const library = await referenceLibrary(db, { orgId: 'o', projectId: 'p1' });

    expect(library.catalogue).toEqual([{ id: 'c1', name: 'Sphere', url: 'https://signed.example/reference-images/catalogue/s.png' }]);
    expect(library.media).toEqual([{ id: 'a1' }]);
  });

  it('senza la tabella del catalogo, il catalogo è vuoto e niente si rompe', async () => {
    const { db } = fakeDb({ assets: [] });
    const broken = {
      ...db,
      from: (table: string) =>
        table === 'reference_images'
          ? { select: () => ({ order: async () => ({ data: null, error: { code: 'PGRST205' } }) }) }
          : db.from(table as never)
    } as unknown as typeof db;

    const library = await referenceLibrary(broken, { orgId: 'o', projectId: 'p1' });

    expect(library.catalogue).toEqual([]);
  });
});
