import { describe, expect, it } from 'vitest';
import { fakeDb, filtersOf } from '$lib/server/db/fake-db';
import { GET } from './+server';

function call(path: string, search: string, user: { id: string } | null = { id: 'u1' }) {
  const { db, calls } = fakeDb({});
  const locals = { safeGetSession: async () => ({ session: user ? {} : null, user }), db: async () => db };
  const url = new URL(`http://localhost/reference-images/${path}${search}`);
  return { calls, response: GET({ params: { path }, locals, url } as never) };
}

describe('GET reference image', () => {
  it('firma solo l\'immagine chiesta, con il preset chiesto, e la rimanda con una cache privata', async () => {
    const { calls, response } = call('catalogue/lazy-1.png', '?preset=mediaGrid');
    const res = await response;

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://signed.example/reference-images/catalogue/lazy-1.png');
    expect(res.headers.get('Cache-Control')).toMatch(/^private, max-age=[1-9]\d*$/);
    const signs = calls.filter((c) => c.op === 'sign');
    expect(signs).toHaveLength(1);
    expect(filtersOf(signs, 'sign').transform).toEqual({ transform: { width: 360, height: 360, resize: 'cover', quality: 70 } });
  });

  it('un preset sconosciuto non firma niente', async () => {
    const { calls, response } = call('catalogue/lazy-2.png', '?preset=huge');
    await expect(response).rejects.toMatchObject({ status: 404 });
    expect(calls.filter((c) => c.op === 'sign')).toEqual([]);
  });

  it('senza sessione si torna al login', async () => {
    const { response } = call('catalogue/lazy-3.png', '?preset=pickerTile', null);
    await expect(response).rejects.toMatchObject({ status: 303 });
  });
});
