import { describe, expect, it, vi } from 'vitest';

const listGallery = vi.fn(async () => [{ id: 'g1', title: 'Launch', authorName: 'Feega', kind: 'motion', format: 'landscape', durationS: 8, tags: [], posterUrl: null, previewUrl: null, remixCount: 0, remixedFrom: null }]);
vi.mock('$lib/server/repos/gallery', () => ({ listGallery }));
vi.mock('$lib/server/dashboard/tool-scope', () => ({ toolScope: vi.fn(async () => ({ projectId: 'p1' })) }));

const { load } = await import('$lib/server/dashboard/pages/templates');

const locals = { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => ({}) };

async function loaded() {
  return (await load({ locals, cookies: { get: () => undefined }, url: new URL('http://x/app/templates') } as never)) as {
    components: { id: string; kind: string }[];
    posters: { id: string; mode: string }[];
    gallery: { id: string }[];
    attachProjectId: string | null;
  };
}

describe('/app/templates holds the catalogue the home no longer carries', () => {
  it('lists every built-in component, with its kind', async () => {
    const data = await loaded();

    expect(data.components.find((c) => c.id === 'builtin:prompt-input')?.kind).toBe('component');
  });

  it('lists the posters: stills only', async () => {
    const data = await loaded();

    expect(data.posters.map((c) => c.id)).toContain('builtin:poster-photo-grid');
    expect(data.posters.every((c) => c.mode === 'still')).toBe(true);
  });

  it('lists the gallery to remix and the project new canvases land in', async () => {
    const data = await loaded();

    expect(data.gallery.map((g) => g.id)).toEqual(['g1']);
    expect(data.attachProjectId).toBe('p1');
  });
});
