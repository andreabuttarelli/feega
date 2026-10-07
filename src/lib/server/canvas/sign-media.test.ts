import { describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { markRlsScoped } from '$lib/server/rls-client';
import { signAssetPaths, signJobAssetPaths, signMediaPaths } from './sign-media';

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

describe('un asset è visibile a chiunque legga la sua riga, non solo a chi lo ha generato', () => {
  it('firma un render con il client di servizio, non con quello dell\'utente', async () => {
    const userDb = markRlsScoped(
      storageWith({ 'canvas-assets': ['o/p/upload.png'] })
    );
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

  it('rifiuta un client utente non marchiato RLS, per non far passare un service client al posto suo', async () => {
    const notRlsScoped = storageWith({});
    const serviceDb = storageWith({ 'brand-knowledge': ['x/media/y.png'] });

    await expect(
      signAssetPaths(notRlsScoped, serviceDb, { generated: ['x/media/y.png'], uploaded: [] })
    ).rejects.toThrow();
  });
});

describe('un job senza sessione firma gli asset della propria org', () => {
  it('firma render e upload con il client di servizio del job ripreso dal tick', async () => {
    const serviceDb = storageWith({ 'brand-knowledge': ['u/media/generated.png'], 'canvas-assets': ['o/p/upload.png'] });

    const urls = await signJobAssetPaths(serviceDb, { generated: ['u/media/generated.png'], uploaded: ['o/p/upload.png'] });

    expect(urls.get('u/media/generated.png')).toBe('https://signed/brand-knowledge/u/media/generated.png');
    expect(urls.get('o/p/upload.png')).toBe('https://signed/canvas-assets/o/p/upload.png');
  });
});
