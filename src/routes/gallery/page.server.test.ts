import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const state = vi.hoisted(() => ({ world: null as null | FakeDb, userId: null as string | null }));

vi.mock('$lib/server/gallery/reader', () => ({ galleryReader: async () => ({ db: state.world!.db, userId: state.userId }) }));

const { load } = await import('./+page.server');

const card = { id: 'g-1', title: 'Liquid glass lens', author_name: 'Feega', kind: 'motion', format: '16:9', duration_s: 7.2, tags: ['glass'], poster_url: null, preview_url: 'https://public.example/media/gallery/g-1/preview.mp4', remix_count: 3, origin: null, status: 'published' };

async function read(query = '') {
  const url = new URL(`https://feega.app/gallery${query}`);
  return (await load({ locals: {}, url } as never)) as { cards: { id: string; title: string; remixCount: number }[]; search: Record<string, unknown>; signedIn: boolean };
}

beforeEach(() => {
  state.world = fakeDb({ gallery_items: [card] });
  state.userId = null;
});

describe('the public gallery', () => {
  it('lists published items for someone without an account', async () => {
    const page = await read();
    expect(page.signedIn).toBe(false);
    expect(page.cards).toEqual([expect.objectContaining({ id: 'g-1', title: 'Liquid glass lens', authorName: 'Feega', remixCount: 3 })]);
    expect(state.world!.calls[0].filters).toContainEqual(['status', 'published']);
  });

  it('filters by format, kind and length from the address', async () => {
    const page = await read('?format=9%3A16&kind=composition&duration=short');
    const filters = state.world!.calls[0].filters;
    expect(filters).toContainEqual(['format', '9:16']);
    expect(filters).toContainEqual(['kind', 'composition']);
    expect(page.search).toMatchObject({ format: '9:16', kind: 'composition', duration: 'short' });
  });

  it('a filter it does not know shows everything instead of breaking the page', async () => {
    const page = await read('?format=8k');
    expect(page.search.format).toBeUndefined();
    expect(page.cards).toHaveLength(1);
  });

  it('filters by a range of seconds from the two-thumb slider', async () => {
    const page = await read('?min=5&max=10');
    const filters = state.world!.calls[0].filters;
    expect(filters).toContainEqual(['duration_s>=', 5]);
    expect(filters).toContainEqual(['duration_s<=', 10]);
    expect(page.search).toMatchObject({ min: 5, max: 10 });
  });

  it('a range upside down is read the right way round', async () => {
    const page = await read('?min=12&max=4');
    expect(page.search).toMatchObject({ min: 4, max: 12 });
  });
});
