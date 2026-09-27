import { describe, expect, it, vi, beforeEach } from 'vitest';

const { fetchSocialFeed, fetchClassifiedEntry, upsertNodeSocialPosts, archiveImageToBucket } = vi.hoisted(() => ({
  fetchSocialFeed: vi.fn(),
  fetchClassifiedEntry: vi.fn(),
  upsertNodeSocialPosts: vi.fn(),
  archiveImageToBucket: vi.fn()
}));

vi.mock('$lib/server/social-feed-fetch', () => ({ fetchSocialFeed, fetchClassifiedEntry }));
vi.mock('$lib/server/repos/social-posts', () => ({ upsertNodeSocialPosts }));
vi.mock('$lib/server/media-archive', () => ({ archiveImageToBucket }));

import { syncSocialFeedNode, syncSocialFeedEntries } from './social-feed-sync';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const NODE = '33333333-3333-3333-3333-333333333333';

beforeEach(() => vi.clearAllMocks());

describe('syncSocialFeedNode', () => {
  it('un handle che non esiste torna l\'errore leggibile e non scrive niente', async () => {
    fetchSocialFeed.mockResolvedValue({ ok: false, error: 'no_posts: no public posts found for @ghost on instagram — check the handle' });

    const out = await syncSocialFeedNode(null as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'instagram',
      handle: 'ghost',
      limit: 20
    });

    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/no_posts/);
    expect(upsertNodeSocialPosts).not.toHaveBeenCalled();
  });

  it('quando il feed riesce, scrive col repository e torna quanti', async () => {
    fetchSocialFeed.mockResolvedValue({ ok: true, posts: [{ externalId: '1' }, { externalId: '2' }] });
    upsertNodeSocialPosts.mockResolvedValue(2);

    const out = await syncSocialFeedNode({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'instagram',
      handle: 'brand',
      limit: 20
    });

    expect(out).toEqual({ ok: true, synced: 2 });
  });

  it('archivia ogni thumbnail di ogni slide nel bucket canvas-assets prima di scrivere', async () => {
    fetchSocialFeed.mockResolvedValue({
      ok: true,
      posts: [
        {
          externalId: '1',
          items: [
            { type: 'image', url: 'https://cdn.example.com/slide1.jpg', thumbnailUrl: 'https://cdn.example.com/slide1.jpg' },
            { type: 'video', url: 'https://cdn.example.com/slide2.mp4', thumbnailUrl: 'https://cdn.example.com/slide2-cover.jpg' }
          ]
        }
      ]
    });
    archiveImageToBucket.mockResolvedValue(`${ORG}/${NODE}/archived.jpg`);
    upsertNodeSocialPosts.mockResolvedValue(1);

    await syncSocialFeedNode({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'instagram',
      handle: 'brand',
      limit: 20
    });

    expect(archiveImageToBucket).toHaveBeenCalledTimes(2);
    expect(archiveImageToBucket).toHaveBeenCalledWith(
      {},
      expect.stringContaining(`${ORG}/${NODE}/`),
      'https://cdn.example.com/slide1.jpg',
      'canvas-assets'
    );

    const [, input] = upsertNodeSocialPosts.mock.calls[0];
    const postedItems = input.posts[0].items;
    expect(postedItems[0].thumbnailPath).toBe(`${ORG}/${NODE}/archived.jpg`);
    expect(postedItems[1].thumbnailPath).toBe(`${ORG}/${NODE}/archived.jpg`);
  });

  it('una thumbnail che non si archivia (link morto) non blocca il giro — resta senza path', async () => {
    fetchSocialFeed.mockResolvedValue({
      ok: true,
      posts: [{ externalId: '1', items: [{ type: 'image', url: 'https://cdn.example.com/dead.jpg', thumbnailUrl: 'https://cdn.example.com/dead.jpg' }] }]
    });
    archiveImageToBucket.mockResolvedValue(null);
    upsertNodeSocialPosts.mockResolvedValue(1);

    const out = await syncSocialFeedNode({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      platform: 'instagram',
      handle: 'brand',
      limit: 20
    });

    expect(out.ok).toBe(true);
    const [, input] = upsertNodeSocialPosts.mock.calls[0];
    expect(input.posts[0].items[0].thumbnailPath).toBeUndefined();
  });
});

describe('syncSocialFeedEntries', () => {
  it('classifica il testo incollato e scarica ogni entry riconosciuta, ognuna con la sua piattaforma', async () => {
    fetchClassifiedEntry.mockImplementation(async (entry: { platform: string }) =>
      entry.platform === 'instagram'
        ? { ok: true, posts: [{ externalId: 'ig-1' }] }
        : { ok: true, posts: [{ externalId: 'tt-1' }] }
    );
    upsertNodeSocialPosts.mockResolvedValue(1);

    const out = await syncSocialFeedEntries({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      raw: '@nike\nhttps://www.tiktok.com/@nike/video/7441152690236771640',
      limit: 20
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.synced).toBe(2);
    expect(out.entries).toHaveLength(2);
    expect(out.entries[0]).toMatchObject({ platform: 'instagram', kind: 'profile', synced: 1 });
    expect(out.entries[1]).toMatchObject({ platform: 'tiktok', kind: 'post', synced: 1 });
    expect(fetchClassifiedEntry).toHaveBeenCalledTimes(2);
  });

  it('un input non riconosciuto o non supportato non blocca gli altri — appare come errore per entry', async () => {
    fetchClassifiedEntry.mockResolvedValue({ ok: true, posts: [{ externalId: 'ig-1' }] });
    upsertNodeSocialPosts.mockResolvedValue(1);

    const out = await syncSocialFeedEntries({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      raw: '@nike, https://www.reddit.com/r/nike/',
      limit: 20
    });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.synced).toBe(1);
    expect(out.entries).toHaveLength(1);
    expect(out.unsupported).toEqual([{ source: 'https://www.reddit.com/r/nike/', reason: 'not_supported', message: expect.stringContaining('reddit') }]);
  });

  it('un testo che non classifica niente torna ok:false con un messaggio leggibile', async () => {
    const out = await syncSocialFeedEntries({} as never, {
      orgId: ORG,
      projectId: PROJECT,
      nodeId: NODE,
      raw: 'https://www.reddit.com/r/nike/',
      limit: 20
    });

    expect(out).toMatchObject({ ok: false });
    expect(fetchClassifiedEntry).not.toHaveBeenCalled();
  });
});
