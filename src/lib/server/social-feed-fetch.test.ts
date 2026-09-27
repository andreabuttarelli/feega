/**
 * `fetchSocialFeed` fa da guardia leggibile davanti a `fetchProfileHistory` (già in produzione,
 * `scrapecreators.ts`): una piattaforma non ancora cablata, un handle vuoto, la chiave mancante e
 * un handle che non esiste sono quattro fatti diversi, e devono tornare quattro errori diversi —
 * non un riquadro vuoto sulla tela senza motivo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { envMock, fetchProfileHistory, fetchSinglePost, isSinglePostPlatform } = vi.hoisted(() => ({
  envMock: {} as Record<string, string | undefined>,
  fetchProfileHistory: vi.fn(),
  fetchSinglePost: vi.fn(),
  isSinglePostPlatform: vi.fn((p: string) => ['instagram', 'tiktok', 'x', 'threads', 'facebook', 'youtube'].includes(p))
}));

vi.mock('$env/dynamic/private', () => ({ env: envMock }));
vi.mock('$lib/server/scrapecreators', () => ({ fetchProfileHistory, fetchSinglePost, isSinglePostPlatform }));

import { fetchSocialFeed, fetchClassifiedEntry, isSupportedFeedPlatform } from './social-feed-fetch';
import type { SocialEntry } from '$lib/canvas/social-url-classifier';

beforeEach(() => {
  vi.clearAllMocks();
  envMock.SCRAPECREATORS_API_KEY = 'test-key';
});

describe('isSupportedFeedPlatform', () => {
  it('accetta le piattaforme cablate su scrapecreators.ts', () => {
    expect(isSupportedFeedPlatform('instagram')).toBe(true);
    expect(isSupportedFeedPlatform('tiktok')).toBe(true);
  });

  it('rifiuta reddit e pinterest — admessi dal CHECK ma non ancora cablati', () => {
    expect(isSupportedFeedPlatform('reddit')).toBe(false);
    expect(isSupportedFeedPlatform('pinterest')).toBe(false);
  });
});

describe('fetchSocialFeed', () => {
  it('rifiuta una piattaforma non supportata senza chiamare scrapecreators', async () => {
    const out = await fetchSocialFeed('reddit', 'somesubreddit', 20);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/unsupported_platform/);
    expect(fetchProfileHistory).not.toHaveBeenCalled();
  });

  it('rifiuta un handle vuoto', async () => {
    const out = await fetchSocialFeed('instagram', '   ', 20);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/missing_handle/);
  });

  it('rifiuta quando la chiave ScrapeCreators non è configurata', async () => {
    envMock.SCRAPECREATORS_API_KEY = undefined;
    const out = await fetchSocialFeed('instagram', 'brand', 20);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/not_configured/);
  });

  it('un handle che non esiste (zero post) torna un errore leggibile, non un array vuoto silenzioso', async () => {
    fetchProfileHistory.mockResolvedValue([]);
    const out = await fetchSocialFeed('instagram', 'nonexistent-handle-xyz', 20);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/no_posts/);
  });

  it('torna i post quando ce ne sono', async () => {
    fetchProfileHistory.mockResolvedValue([
      { externalId: '1', url: 'https://instagram.com/p/1', content: 'hi', mediaType: 'image', thumbnailUrl: null, publishedAt: null, metrics: {} }
    ]);
    const out = await fetchSocialFeed('instagram', 'brand', 20);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.posts).toHaveLength(1);
  });

  it('un errore di rete diventa fetch_failed invece di propagarsi non gestito', async () => {
    fetchProfileHistory.mockRejectedValue(new Error('ECONNRESET'));
    const out = await fetchSocialFeed('instagram', 'brand', 20);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/fetch_failed/);
  });
});

const entry = (over: Partial<SocialEntry>): SocialEntry => ({
  platform: 'instagram',
  kind: 'profile',
  handle: 'nike',
  id: null,
  source: 'https://www.instagram.com/nike/',
  ...over
});

describe('fetchClassifiedEntry', () => {
  it('un profilo scarica lo storico come fetchSocialFeed', async () => {
    fetchProfileHistory.mockResolvedValue([
      { externalId: '1', url: null, content: null, mediaType: 'image', thumbnailUrl: null, publishedAt: null, metrics: {} }
    ]);
    const out = await fetchClassifiedEntry(entry({ kind: 'profile', handle: 'nike' }), 20);
    expect(out.ok).toBe(true);
    expect(fetchProfileHistory).toHaveBeenCalledWith('instagram', { username: 'nike', profileUrl: null }, { maxPosts: 20 });
  });

  it('un post singolo su una piattaforma cablata scarica quel solo post', async () => {
    fetchSinglePost.mockResolvedValue({ externalId: 'p1', url: 'https://x.com/nike/status/1', content: null, mediaType: 'text', thumbnailUrl: null, publishedAt: null, metrics: {} });
    const out = await fetchClassifiedEntry(entry({ platform: 'x', kind: 'post', handle: null, id: '1', source: 'https://x.com/nike/status/1' }), 20);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.posts).toHaveLength(1);
    expect(fetchSinglePost).toHaveBeenCalledWith('x', 'https://x.com/nike/status/1');
  });

  it('un post singolo su linkedin (senza single-post fetch) rifiuta esplicitamente', async () => {
    isSinglePostPlatform.mockReturnValueOnce(false);
    const out = await fetchClassifiedEntry(entry({ platform: 'linkedin', kind: 'post', handle: null, id: '1', source: 'https://linkedin.com/x' }), 20);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/unsupported_platform/);
    expect(fetchSinglePost).not.toHaveBeenCalled();
  });

  it('un hashtag dice esplicitamente che non è ancora cablato, non torna un array vuoto', async () => {
    const out = await fetchClassifiedEntry(entry({ kind: 'hashtag', handle: 'running', source: '#running' }), 20);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/not_supported/);
  });

  it('un errore del fetch del singolo post diventa fetch_failed', async () => {
    fetchSinglePost.mockRejectedValue(new Error('404'));
    const out = await fetchClassifiedEntry(entry({ kind: 'post', handle: null, id: '1', source: 'https://www.instagram.com/p/1/' }), 20);
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toMatch(/fetch_failed/);
  });
});
