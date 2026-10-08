import { describe, expect, it, vi } from 'vitest';
import { fakeDb, type Call } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, type OpResult } from '$lib/motion/timeline';
import { PublishRefusal } from '$lib/gallery/refusals';
import { publishToGallery, PublishError, withdrawFromGallery, type GalleryModeration } from './publish';
import { remixGalleryItem, RemixError } from './remix';

const ORG = 'org-1';
const LOGO = 'a0000000-0000-4000-8000-000000000001';
const POSTER = 'a0000000-0000-4000-8000-000000000002';
const RENDER = 'a0000000-0000-4000-8000-000000000003';
const ACTOR = { kind: 'user' as const, id: 'u-1' };
const META = { title: 'Liquid glass', description: 'A lens over a headline.', tags: ['glass'] };

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

function demo(): MotionDoc {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 90, props: { text: 'Make it move.' } }, 'title'));
  doc = must(addClip(doc, { component: 'Logo', from: 30, durationInFrames: 60, props: { assetId: LOGO } }, 'logo'));
  return { ...doc, durationInFrames: 216, assets: [{ id: LOGO, kind: 'image', name: 'logo' }] };
}

const asset = (id: string, type: string, url: string, source = 'upload') => ({ id, org_id: ORG, project_id: 'p-1', type, url, source, mime_type: null, bytes: null, width: null, height: null, duration_s: null, source_node_id: null, uncensored: false, created_at: '2026-10-01' });

function world(over: { doc?: MotionDoc; mode?: string; logoSource?: string } = {}) {
  let n = 0;
  return fakeDb(
    {
      nodes: [{ id: 'n-1', org_id: ORG, canvas_id: 'c-1', project_id: 'p-1', type: 'motion', display_name: 'Demo', x: 0, y: 0, z: 0, width: null, height: null, version: 3, data: { format: '16:9', docHeadRevision: 1, posterAssetId: POSTER, lastRenderAssetId: RENDER } }],
      motion_revisions: [{ org_id: ORG, node_id: 'n-1', version: 1, doc: over.doc ?? demo(), summary: null, actor_kind: 'user' }],
      projects: [{ id: 'p-1', org_id: ORG, name: 'P', slug: 'p', brand_id: null, archived_at: null, updated_at: '2026-10-01', mode: over.mode ?? 'standard' }],
      assets: [asset(LOGO, 'image', `${ORG}/p-1/${over.logoSource === 'imported' ? 'imports/' : ''}logo.svg`, over.logoSource), asset(POSTER, 'image', `${ORG}/p-1/poster.png`), asset(RENDER, 'video', `${ORG}/p-1/render.mp4`)],
      gallery_remixes: []
    },
    { filter: true, newId: () => `item-${++n}` }
  );
}

const sign = async (paths: { generated: string[]; uploaded: string[] }) => new Map([...paths.generated, ...paths.uploaded].map((p) => [p, `https://signed.example/${p}`]));
const MIME: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', mp4: 'video/mp4' };
const download = vi.fn(async (url: string) => ({ bytes: Buffer.from(url), mime: MIME[url.split('.').at(-1) ?? ''] ?? 'application/octet-stream' }));
const clear: GalleryModeration = { text: async () => ({ ok: true }), media: async () => ({ ok: true }) };

const input = { orgId: ORG, userId: 'u-1', authorName: 'Ada Studio', actor: ACTOR, nodeId: 'n-1', meta: META };
const of = (calls: Call[], table: string, op: string) => calls.filter((c) => c.table === table && c.op === op);

describe('publishing a motion video to the gallery', () => {
  it('snapshots the doc and copies every file to the public gallery folder', async () => {
    const { db, calls } = world();
    const texts: string[][] = [];
    const moderation: GalleryModeration = { text: async (t) => (texts.push(t), { ok: true }), media: async () => ({ ok: true }) };

    const published = await publishToGallery(db, { moderation, download, sign }, input);

    expect(published).toEqual({ ok: true, id: 'item-1' });
    expect(texts[0]).toEqual(['Liquid glass', 'A lens over a headline.', 'glass', 'Make it move.']);
    expect(of(calls, 'gallery_items', 'insert')[0].payload).toMatchObject({ org_id: ORG, user_id: 'u-1', author_name: 'Ada Studio', kind: 'motion', format: '16:9', duration_s: 7.2, status: 'unlisted', source_node_id: 'n-1', remixed_from: null, actor_kind: 'user' });

    const uploads = of(calls, 'storage:media', 'upload').map((c) => String(c.filters[0][1]));
    expect(uploads).toHaveLength(3);
    expect(uploads.every((p) => p.startsWith('gallery/item-1/'))).toBe(true);
    expect(uploads.slice(1)).toEqual(['gallery/item-1/poster.png', 'gallery/item-1/preview.mp4']);

    const release = of(calls, 'gallery_items', 'update')[0].payload as { status: string; doc: MotionDoc; assets: { id: string; url: string }[]; poster_url: string };
    expect(release.status).toBe('published');
    expect(JSON.stringify(release.doc)).not.toContain(LOGO);
    expect(release.doc.assets[0].id).toBe(release.assets[0].id);
    expect(release.assets[0].url).toBe(`https://public.example/media/${uploads[0]}`);
    expect(release.poster_url).toBe('https://public.example/media/gallery/item-1/poster.png');
  });

  it('refuses an uncensored project before anything is written', async () => {
    const { db, calls } = world({ mode: 'uncensored' });
    const published = await publishToGallery(db, { moderation: clear, download, sign }, input);
    expect(published).toMatchObject({ ok: false, error: PublishRefusal.Uncensored });
    expect(of(calls, 'gallery_items', 'insert')).toEqual([]);
  });

  it('refuses a logo imported from a real website', async () => {
    const { db, calls } = world({ logoSource: 'imported' });
    const published = await publishToGallery(db, { moderation: clear, download, sign }, input);
    expect(published).toMatchObject({ ok: false, error: PublishRefusal.SiteMaterial });
    expect(of(calls, 'gallery_items', 'insert')).toEqual([]);
  });

  it('refuses text the moderation refuses, and media it refuses', async () => {
    const refusedText: GalleryModeration = { ...clear, text: async () => ({ ok: false, error: 'Refused: hate' }) };
    const first = world();
    expect(await publishToGallery(first.db, { moderation: refusedText, download, sign }, input)).toEqual({ ok: false, error: PublishError.Moderated, message: 'Refused: hate' });
    expect(of(first.calls, 'gallery_items', 'insert')).toEqual([]);

    const seen: string[] = [];
    const refusedMedia: GalleryModeration = { ...clear, media: async (refs) => (seen.push(...refs.map((r) => `${r.medium}:${r.url}`)), { ok: false, error: 'Refused: media' }) };
    const second = world();
    expect(await publishToGallery(second.db, { moderation: refusedMedia, download, sign }, input)).toMatchObject({ ok: false, error: PublishError.Moderated });
    expect(seen).toEqual([`image:https://signed.example/${ORG}/p-1/logo.svg`, `image:https://signed.example/${ORG}/p-1/poster.png`, `video:https://signed.example/${ORG}/p-1/render.mp4`]);
  });

  it('withdrawing hides the item and takes its public files down', async () => {
    const { db, calls } = fakeDb({ gallery_items: [{ id: 'item-1', org_id: ORG, status: 'published' }] }, { filter: true });
    expect(await withdrawFromGallery(db, { orgId: ORG, itemId: 'item-1' })).toBe(true);
    expect(of(calls, 'gallery_items', 'update')[0].payload).toMatchObject({ status: 'removed' });
    expect(of(calls, 'storage:media', 'list')[0].filters).toEqual([['folder', 'gallery/item-1']]);
  });
});

const PUBLIC = 'https://public.example/media/gallery/item-1/';

function galleryRow(assets: { id: string; kind: string; name: string; url: string }[]) {
  const doc = { ...demo(), assets: [{ id: 'g-logo', kind: 'image', name: 'logo' }] } as MotionDoc;
  doc.tracks[0].clips = doc.tracks[0].clips.map((c) => (c.id === 'logo' ? { ...c, props: { ...c.props, assetId: 'g-logo' } } : c));
  return { id: 'item-1', org_id: 'feega', status: 'published', title: 'Liquid glass', author_name: 'Feega', kind: 'motion', format: '16:9', duration_s: 7.2, tags: [], poster_url: null, preview_url: null, remix_count: 0, origin: null, description: '', doc, assets, published_at: '2026-10-08' };
}

function remixWorld(assets = [{ id: 'g-logo', kind: 'image', name: 'logo', url: `${PUBLIC}g-logo.svg` }]) {
  let n = 0;
  return fakeDb({ gallery_items: [galleryRow(assets)], canvases: [{ id: 'c-9', org_id: 'org-2', project_id: 'p-2', name: 'Motion', viewport: null }], nodes: [], assets: [], gallery_remixes: [] }, { filter: true, newId: () => `new-${++n}` });
}

const remixInput = { orgId: 'org-2', userId: 'u-2', actor: { kind: 'user' as const, id: 'u-2' }, itemId: 'item-1', projectId: 'p-2', canvasId: null };

describe('remixing a gallery item', () => {
  it('copies the files into the project, rewires the doc and records the chain', async () => {
    const { db, calls } = remixWorld();

    const remixed = await remixGalleryItem(db, { download }, remixInput);

    expect(remixed).toMatchObject({ ok: true, title: 'Liquid glass', editorPath: expect.stringMatching(/^\/p\/p-2\/c\/c-9\/motion\//) });
    const stored = of(calls, 'storage:canvas-assets', 'upload').map((c) => String(c.filters[0][1]));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatch(/^org-2\/p-2\/remix\/.+\.svg$/);
    expect(of(calls, 'assets', 'insert')[0].payload).toMatchObject({ org_id: 'org-2', project_id: 'p-2', type: 'image', source: 'imported', url: stored[0], mime_type: 'image/svg+xml' });

    const assetId = 'new-1';
    const revision = of(calls, 'motion_revisions', 'insert')[0].payload as { doc: MotionDoc; version: number; summary: string };
    expect(revision.version).toBe(1);
    expect(revision.summary).toBe('Remix of Liquid glass');
    expect(revision.doc.assets[0].id).toBe(assetId);
    expect(JSON.stringify(revision.doc)).not.toContain('g-logo');
    expect(revision.doc.fields.map((f) => f.key)).toEqual(['text_1', 'logo_1']);

    expect(of(calls, 'gallery_remixes', 'insert')[0].payload).toMatchObject({ org_id: 'org-2', item_id: 'item-1', actor_kind: 'user', actor_id: 'u-2' });
  });

  it("re-inserts the item's custom effects into the remixer's workspace, renamed on a clash, and points the clips at them", async () => {
    const shader = { name: 'vhs', version: 3, frag: 'vec4 effect(vec2 uv) { return texture2D(u_src, uv); }', params: [] };
    const row = galleryRow([{ id: 'g-logo', kind: 'image', name: 'logo', url: `${PUBLIC}g-logo.svg` }]);
    const doc = { ...row.doc, shaders: { 'author-fx': shader } } as MotionDoc;
    doc.tracks[0].clips = doc.tracks[0].clips.map((c) => (c.id === 'logo' ? { ...c, component: 'Image' as const, shaders: [{ id: 's1', ref: 'author-fx', enabled: true, params: {} }] } : c));
    let n = 0;
    const own = { id: 'mine', org_id: 'org-2', name: 'vhs', version: 1, frag: 'x', params: [], check_state: 'passed', check_problems: [], cost_ms: 1, deleted_at: null, updated_at: 'now' };
    const { db, calls } = fakeDb({ gallery_items: [{ ...row, doc }], canvases: [{ id: 'c-9', org_id: 'org-2', project_id: 'p-2', name: 'Motion', viewport: null }], nodes: [], assets: [], gallery_remixes: [], effects: [own] }, { filter: true, newId: () => `new-${++n}` });

    expect(await remixGalleryItem(db, { download }, remixInput)).toMatchObject({ ok: true });

    const inserted = of(calls, 'effects', 'insert')[0].payload as { org_id: string; name: string; frag: string };
    expect(inserted).toMatchObject({ org_id: 'org-2', name: 'vhs-2', frag: shader.frag });
    const revision = of(calls, 'motion_revisions', 'insert')[0].payload as { doc: MotionDoc };
    const newRef = Object.keys(revision.doc.shaders)[0];
    expect(newRef).not.toBe('author-fx');
    expect(revision.doc.shaders[newRef].name).toBe('vhs-2');
    expect(revision.doc.tracks[0].clips.find((c) => c.id === 'logo')!.shaders[0].ref).toBe(newRef);
  });

  it("re-inserts the custom layout of a composition into the remixer's workspace and points the clip at it", async () => {
    const row = galleryRow([{ id: 'g-logo', kind: 'image', name: 'logo', url: `${PUBLIC}g-logo.svg` }]);
    const spec = { kind: 'spec', name: 'orbit', slots: 6, place: { kind: 'ring', radius: 3 } };
    const doc = must(addClip(row.doc, { component: 'Composition', from: 0, durationInFrames: 60, props: { layout: 'custom', layoutRef: 'author-lay', layoutSpec: spec } }, 'comp'));
    let n = 0;
    const { db, calls } = fakeDb({ gallery_items: [{ ...row, doc }], canvases: [{ id: 'c-9', org_id: 'org-2', project_id: 'p-2', name: 'Motion', viewport: null }], nodes: [], assets: [], gallery_remixes: [], effects: [], layouts: [] }, { filter: true, newId: () => `new-${++n}` });

    expect(await remixGalleryItem(db, { download }, remixInput)).toMatchObject({ ok: true });

    expect(of(calls, 'layouts', 'insert')[0].payload).toMatchObject({ org_id: 'org-2', name: 'orbit', kind: 'spec' });
    const revision = of(calls, 'motion_revisions', 'insert')[0].payload as { doc: MotionDoc };
    const comp = revision.doc.tracks.flatMap((t) => t.clips).find((c) => c.id === 'comp')!;
    expect((comp.props as { layoutRef: string }).layoutRef).not.toBe('author-lay');
  });

  it('never fetches a file outside the gallery folder of that item', async () => {
    const { db, calls } = remixWorld([{ id: 'g-logo', kind: 'image', name: 'logo', url: 'http://169.254.169.254/latest/meta-data' }]);
    expect(await remixGalleryItem(db, { download }, remixInput)).toMatchObject({ ok: false, error: RemixError.ForeignFile });
    expect(of(calls, 'nodes', 'insert')).toEqual([]);
  });

  it('a withdrawn item cannot be remixed', async () => {
    const { db } = fakeDb({ gallery_items: [] }, { filter: true });
    expect(await remixGalleryItem(db, { download }, remixInput)).toMatchObject({ ok: false, error: RemixError.NotFound });
  });
});
