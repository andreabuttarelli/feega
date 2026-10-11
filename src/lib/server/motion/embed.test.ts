import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://sb.test', PUBLIC_APP_URL: 'https://oh.feega.app' } }));

const { EMBED_BUCKET, embedSlot, publishEmbed, readEmbed, readEmbedAsset, readEmbedSettings, removeEmbed, embedPublished } = await import('./embed');
const { Chunk, chunkUrl } = await import('$lib/motion/hyperframes/runtime-chunks');
const { MotionFormat, newMotionDoc } = await import('$lib/motion/doc');
const { FEEGA_TOKENS } = await import('$lib/motion/brand');
const { ProjectMode } = await import('$lib/project-mode');
const { addClip } = await import('$lib/motion/timeline');

const NODE = '6f1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40';

function fakeDb(listed: string[] = []) {
  const bucket = {
    upload: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
    list: vi.fn(async () => ({ data: listed.map((name) => ({ name })), error: null })),
    createSignedUploadUrl: vi.fn(async () => ({ data: { signedUrl: 'https://sb.test/upload?token=t' }, error: null }))
  };
  const from = vi.fn(() => bucket);
  return { db: { storage: { from } } as never, bucket, from };
}

describe('hosted embed', () => {
  it('publishing stores one html file per node, overwriting the last one, and returns the loader snippet for that node', async () => {
    const { db, bucket, from } = fakeDb();
    const doc = newMotionDoc(MotionFormat.Landscape);

    const fetchBlob = vi.fn(async () => new Blob(['window.lib=1;']));
    const out = await publishEmbed(db, { nodeId: NODE, doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Clip', fetchBlob, mode: ProjectMode.Standard });

    expect(from).toHaveBeenCalledWith(EMBED_BUCKET);
    expect(bucket.upload).toHaveBeenCalledWith(`${NODE}.html`, expect.any(Blob), expect.objectContaining({ contentType: 'text/html', upsert: true }));
    expect(out).toMatchObject({ ok: true, url: `https://oh.feega.app/e/${NODE}` });
    expect(out.ok && out.snippet).toBe(`<script src="https://oh.feega.app/embed.js" async></script>\n<feega-motion src="${NODE}"></feega-motion>`);
  });

  it('the upload slot for the editor is signed for the same path, with the headers the upload must carry', async () => {
    const { db, bucket } = fakeDb();

    const slot = await embedSlot(db, NODE, ProjectMode.Standard);

    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(`${NODE}.html`, { upsert: true });
    expect(slot).toMatchObject({ ok: true, upload: { url: 'https://sb.test/upload?token=t', headers: expect.objectContaining({ 'content-type': 'text/html', 'x-upsert': 'true' }) } });
  });

  it('an uncensored project is never published as an embed, by the agent or the editor', async () => {
    const { db, bucket } = fakeDb();
    const doc = newMotionDoc(MotionFormat.Landscape);

    const published = await publishEmbed(db, { nodeId: NODE, doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Clip', fetchBlob: vi.fn(), mode: ProjectMode.Uncensored });
    const slot = await embedSlot(db, NODE, ProjectMode.Uncensored);

    expect(published).toMatchObject({ ok: false, error: expect.stringContaining('uncensored') });
    expect(slot).toMatchObject({ ok: false, error: expect.stringContaining('uncensored') });
    expect(bucket.upload).not.toHaveBeenCalled();
    expect(bucket.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('unpublishing removes the file, and published reads whether it is there', async () => {
    const { db, bucket } = fakeDb([`${NODE}.html`]);

    expect(await embedPublished(db, NODE)).toBe(true);
    expect(await removeEmbed(db, NODE)).toEqual({ ok: true });
    expect(bucket.remove).toHaveBeenCalledWith([`${NODE}.html`]);
    expect(await embedPublished(fakeDb().db, NODE)).toBe(false);
  });

  it('the public read fetches only a node id, and a missing file is null', async () => {
    const fetchFn = vi.fn(async (url: string) => (url.endsWith(`${NODE}.html`) ? new Response('<html>ok</html>') : new Response('', { status: 404 })));

    expect(await readEmbed(fetchFn as never, NODE, 'https://oh.feega.app')).toBe('<html>ok</html>');
    expect(fetchFn).toHaveBeenCalledWith(`https://sb.test/storage/v1/object/public/${EMBED_BUCKET}/${NODE}.html`);
    expect(await readEmbed(fetchFn as never, '7a1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40', 'https://oh.feega.app')).toBeNull();
    expect(await readEmbed(fetchFn as never, '../secrets', 'https://oh.feega.app')).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('publishing stores the clip, not the engine, so the page is built with the runtime of the day it is read', async () => {
    const { db, bucket } = fakeDb();
    const doc = newMotionDoc(MotionFormat.Landscape);
    const fetchBlob = vi.fn(async () => new Blob(['window.lib=1;']));

    await publishEmbed(db, { nodeId: NODE, doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Clip', fetchBlob, mode: ProjectMode.Standard });
    const stored = await ((bucket.upload.mock.calls[0] as unknown[])[1] as Blob).text();
    const fetchFn = vi.fn(async () => new Response(stored));
    const page = (await readEmbed(fetchFn as never, NODE, 'https://oh.feega.app'))!;

    expect(stored).not.toContain('motionEngine');
    expect(stored).toContain(`"durationInFrames":${doc.durationInFrames}`);
    expect(page).toContain(chunkUrl('https://oh.feega.app', Chunk.Engine));
    expect(page).toContain('<title>Clip</title>');
    expect(await readEmbedSettings(fetchFn as never, NODE)).toMatchObject({ width: doc.width, height: doc.height });
  });

  it('a large asset of a stored clip is served from its own cached url', async () => {
    const { db, bucket } = fakeDb();
    const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Image', from: 0, durationInFrames: 60, props: { assetId: 'pic' } }, 'card');
    const doc = added.ok ? added.doc : newMotionDoc(MotionFormat.Landscape);
    const big = new Blob([new Uint8Array(4096).fill(7)], { type: 'image/png' });

    await publishEmbed(db, { nodeId: NODE, doc, tokens: FEEGA_TOKENS, assetUrls: { pic: 'https://x.test/a.png' }, title: 'Clip', fetchBlob: vi.fn(async () => big), mode: ProjectMode.Standard });
    const stored = await ((bucket.upload.mock.calls[0] as unknown[])[1] as Blob).text();
    const fetchFn = vi.fn(async () => new Response(stored));
    const hash = /\/e\/[^/]+\/a\/([0-9a-f]+)/.exec((await readEmbed(fetchFn as never, NODE, 'https://oh.feega.app'))!)?.[1];

    expect(hash).toBeDefined();
    expect((await readEmbedAsset(fetchFn as never, NODE, hash!))?.bytes.length).toBe(4096);
  });
});
