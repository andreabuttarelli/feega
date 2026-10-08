import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_SUPABASE_URL: 'https://sb.test', PUBLIC_APP_URL: 'https://oh.feega.app' } }));

const { EMBED_BUCKET, embedSlot, publishEmbed, readEmbed, removeEmbed, embedPublished } = await import('./embed');
const { MotionFormat, newMotionDoc } = await import('$lib/motion/doc');
const { FEEGA_TOKENS } = await import('$lib/motion/brand');

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
  it('publishing stores one html file per node, overwriting the last one, and returns a snippet pointing at the public route', async () => {
    const { db, bucket, from } = fakeDb();
    const doc = newMotionDoc(MotionFormat.Landscape);

    const out = await publishEmbed(db, { nodeId: NODE, doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Clip', fetchBlob: vi.fn() });

    expect(from).toHaveBeenCalledWith(EMBED_BUCKET);
    expect(bucket.upload).toHaveBeenCalledWith(`${NODE}.html`, expect.any(Blob), expect.objectContaining({ contentType: 'text/html', upsert: true }));
    expect(out).toMatchObject({ ok: true, url: `https://oh.feega.app/e/${NODE}` });
    expect(out.ok && out.snippet).toContain(`src="https://oh.feega.app/e/${NODE}"`);
  });

  it('the upload slot for the editor is signed for the same path, with the headers the upload must carry', async () => {
    const { db, bucket } = fakeDb();

    const slot = await embedSlot(db, NODE);

    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(`${NODE}.html`, { upsert: true });
    expect(slot).toMatchObject({ ok: true, upload: { url: 'https://sb.test/upload?token=t', headers: expect.objectContaining({ 'content-type': 'text/html', 'x-upsert': 'true' }) } });
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

    expect(await readEmbed(fetchFn as never, NODE)).toBe('<html>ok</html>');
    expect(fetchFn).toHaveBeenCalledWith(`https://sb.test/storage/v1/object/public/${EMBED_BUCKET}/${NODE}.html`);
    expect(await readEmbed(fetchFn as never, '7a1c2a8e-0b7d-4f1e-9a3c-2d5e8f7a1b40')).toBeNull();
    expect(await readEmbed(fetchFn as never, '../secrets')).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
