import { describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { markRlsScoped } from '$lib/server/rls-client';
import { signAssetPaths, signMediaPaths } from './sign-media';

function storageWith(buckets: Record<string, string[]>): Db {
  return {
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({
            path,
            signedUrl: (buckets[bucket] ?? []).includes(path) ? `https://signed/${bucket}/${path}` : null
          }))
        })
      })
    }
  } as unknown as Db;
}

describe('un file in Storage arriva al modello come URL firmato, non come percorso', () => {
  it('firma un render dal bucket dei render e un upload dal bucket della tela, nello stesso ordine', async () => {
    const db = storageWith({ 'brand-knowledge': ['u/media/generated.png'], 'canvas-assets': ['o/p/upload.png'] });

    const urls = await signMediaPaths(db, ['u/media/generated.png', 'o/p/upload.png']);

    expect(urls).toEqual(['https://signed/brand-knowledge/u/media/generated.png', 'https://signed/canvas-assets/o/p/upload.png']);
  });

  it('lascia com\'è un URL già assoluto e scarta un percorso che nessun bucket conosce', async () => {
    const db = storageWith({});

    const urls = await signMediaPaths(db, ['https://cdn.example/x.png', 'missing/path.png']);

    expect(urls).toEqual(['https://cdn.example/x.png']);
  });
});

describe('un URL dato a un fornitore scade presto', () => {
  it('firma render e upload per cinque minuti, non per ore', async () => {
    const ttls: Record<string, number> = {};
    const db = {
      storage: {
        from: (bucket: string) => ({
          createSignedUrls: async (paths: string[], ttl: number) => {
            ttls[bucket] = ttl;
            return { data: paths.map((path) => ({ path, signedUrl: `https://signed/${bucket}/${path}` })) };
          }
        })
      }
    } as unknown as Db;

    await signMediaPaths(db, ['u/media/for-provider.png']);

    expect(ttls).toEqual({ 'brand-knowledge': 300, 'canvas-assets': 300 });
  });
});

function rowsOf(org: string, assetUrls: string[], buckets: Record<string, string[]> = {}) {
  const asked = { rows: 0 };
  const db = Object.assign(storageWith(buckets), {
    from: () => ({
      select: () => ({
        in: async (_column: string, wanted: string[]) => (asked.rows++, { data: assetUrls.filter((url) => wanted.includes(url)).map((url) => ({ url, org_id: org })), error: null })
      })
    })
  }) as unknown as Db;
  return Object.assign(db, { asked });
}

describe('un asset è visibile a chiunque legga la sua riga, non solo a chi lo ha generato', () => {
  it('firma un render con il client di servizio, non con quello dell\'utente', async () => {
    const userDb = markRlsScoped(rowsOf('o', ['other-user/media/generated.png', 'o/p/upload.png']));
    const serviceDb = storageWith({
      'brand-knowledge': ['other-user/media/generated.png'],
      'canvas-assets': ['o/p/upload.png']
    });

    const urls = await signAssetPaths(userDb, serviceDb, {
      generated: ['other-user/media/generated.png'],
      uploaded: ['o/p/upload.png']
    });

    expect(urls.get('other-user/media/generated.png')).toBe(
      'https://signed/brand-knowledge/other-user/media/generated.png'
    );
    expect(urls.get('o/p/upload.png')).toBe('https://signed/canvas-assets/o/p/upload.png');
  });

  it("non firma mai un file che sta fuori dalle org di chi chiede, qualunque cosa dica la riga", async () => {
    const userDb = markRlsScoped(rowsOf('o', ['their-org/p/x.png']));
    const serviceDb = storageWith({ 'brand-knowledge': ['stranger/media/x.png'], 'canvas-assets': ['their-org/p/x.png'] });

    const urls = await signAssetPaths(userDb, serviceDb, { generated: ['stranger/media/x.png'], uploaded: ['their-org/p/x.png'] });

    expect([...urls.keys()]).toEqual([]);
  });

  it("firma l'immagine di un collega che ha lasciato l'org, perché la riga che la tiene è dell'org", async () => {
    const userDb = markRlsScoped(rowsOf('o', ['gone/media/old.png']));
    const serviceDb = storageWith({ 'brand-knowledge': ['gone/media/old.png'] });

    const urls = await signAssetPaths(userDb, serviceDb, { generated: ['gone/media/old.png'], uploaded: [] });

    expect(urls.get('gone/media/old.png')).toBe('https://signed/brand-knowledge/gone/media/old.png');
  });

  it("un file generato salvato nella cartella dell'org si firma dal bucket della tela", async () => {
    const userDb = markRlsScoped(rowsOf('o', ['o/p/effects/out.png']));
    const serviceDb = storageWith({ 'canvas-assets': ['o/p/effects/out.png'] });

    const urls = await signAssetPaths(userDb, serviceDb, { generated: ['o/p/effects/out.png'], uploaded: [] });

    expect(urls.get('o/p/effects/out.png')).toBe('https://signed/canvas-assets/o/p/effects/out.png');
  });

  it('legge le righe una volta per richiesta', async () => {
    const userDb = markRlsScoped(rowsOf('o', ['o/p/a.png']));
    const serviceDb = storageWith({ 'canvas-assets': ['o/p/a.png'] });

    await signAssetPaths(userDb, serviceDb, { generated: [], uploaded: ['o/p/a.png'] });
    const first = (userDb as unknown as { asked: { rows: number } }).asked.rows;
    await signAssetPaths(userDb, serviceDb, { generated: [], uploaded: ['o/p/a.png'] });

    expect((userDb as unknown as { asked: { rows: number } }).asked.rows).toBe(first);
  });

  it('rifiuta un client utente non marchiato RLS, per non far passare un service client al posto suo', async () => {
    const notRlsScoped = storageWith({});
    const serviceDb = storageWith({ 'brand-knowledge': ['x/media/y.png'] });

    await expect(
      signAssetPaths(notRlsScoped, serviceDb, { generated: ['x/media/y.png'], uploaded: [] })
    ).rejects.toThrow();
  });
});
