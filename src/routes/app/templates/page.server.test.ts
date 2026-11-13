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
    nodeTemplates: { id: string; family: string; description: string; thumbnail: string }[];
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

  it('lists composition and effects templates from the canvas library, each with a family, a description and a preview', async () => {
    const data = await loaded();

    expect(data.nodeTemplates.find((t) => t.id === 'fx-word-field')?.family).toBe('effects');
    expect(data.nodeTemplates.find((t) => t.id === 'composition-bento')?.family).toBe('composition');
    expect(data.nodeTemplates.every((t) => t.description.length > 0 && t.thumbnail.endsWith('.webp'))).toBe(true);
  });
});
