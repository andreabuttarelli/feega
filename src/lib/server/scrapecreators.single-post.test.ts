/**
 * `fetchSinglePost` scarica UN post per URL, per i node social_account_feed che l'utente ha
 * incollato come URL di un post invece che di un profilo (`social-url-classifier.ts::kind`).
 * Stesso contratto dei mapper di storico: un `NormalizedPost`, mai un `null`/`undefined` che il
 * chiamante deve indovinare.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { envMock } = vi.hoisted(() => ({ envMock: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));

import { fetchSinglePost, isSinglePostPlatform } from './scrapecreators';

beforeEach(() => {
  vi.clearAllMocks();
  envMock.SCRAPECREATORS_API_KEY = 'test-key';
  vi.stubGlobal('fetch', vi.fn());
});

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('isSinglePostPlatform', () => {
  it('instagram tiktok x threads facebook youtube sono cablati', () => {
    for (const p of ['instagram', 'tiktok', 'x', 'threads', 'facebook', 'youtube']) {
      expect(isSinglePostPlatform(p)).toBe(true);
    }
  });

  it('linkedin e piattaforme sconosciute non lo sono', () => {
    expect(isSinglePostPlatform('linkedin')).toBe(false);
    expect(isSinglePostPlatform('reddit')).toBe(false);
    expect(isSinglePostPlatform('pinterest')).toBe(false);
  });
});

describe('fetchSinglePost', () => {
  it('instagram: un post foto, incartato in data.xdt_shortcode_media come la risposta vera', async () => {
    // Verificato dal vivo il 2026-09-27 contro api.scrapecreators.com: la risposta reale non è
    // piatta — un mapper scritto solo sui docs riassunti torna content/thumbnail/data tutti null.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          xdt_shortcode_media: {
            id: 'ig1',
            shortcode: 'ABC123',
            is_video: false,
            display_url: 'https://cdn/ig.jpg',
            edge_media_to_caption: { edges: [{ node: { text: 'nice shot' } }] },
            created_at: '1700000000',
            edge_media_preview_like: { count: 42 },
            comment_count: 3
          }
        }
      })
    );

    const post = await fetchSinglePost('instagram', 'https://www.instagram.com/p/ABC123/');
    expect(post.mediaType).toBe('image');
    expect(post.url).toBe('https://www.instagram.com/p/ABC123/');
    expect(post.content).toBe('nice shot');
    expect(post.thumbnailUrl).toBe('https://cdn/ig.jpg');
    expect(post.metrics.likes).toBe(42);
    expect(post.metrics.comments).toBe(3);
  });

  it('tiktok: un video con aweme_detail annidato', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        aweme_detail: {
          aweme_id: '77',
          desc: 'dance',
          create_time: 1700000000,
          share_url: 'https://tiktok.com/@nike/video/77',
          video: { play_addr: { url_list: ['https://cdn/tt.mp4'] }, cover: { url_list: ['https://cdn/cover.jpg'] } },
          statistics: { play_count: 900, digg_count: 30 }
        }
      })
    );

    const post = await fetchSinglePost('tiktok', 'https://www.tiktok.com/@nike/video/77');
    expect(post.mediaType).toBe('video');
    expect(post.metrics.views).toBe(900);
    expect(post.videoUrl).toBe('https://cdn/tt.mp4');
  });

  it('x: un tweet con testo e nessun media', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        rest_id: '99',
        legacy: { full_text: 'hello world', created_at: 'Wed Oct 10 20:19:24 +0000 2018', favorite_count: 5 }
      })
    );

    const post = await fetchSinglePost('x', 'https://x.com/nike/status/99');
    expect(post.mediaType).toBe('text');
    expect(post.content).toBe('hello world');
  });

  it('youtube: un video con durata e statistiche', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        id: 'dQw4w9WgXcQ',
        title: 'a video',
        thumbnail: 'https://cdn/yt.jpg',
        durationMs: 213000,
        viewCountInt: 12345
      })
    );

    const post = await fetchSinglePost('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(post.mediaType).toBe('video');
    expect(post.metrics.views).toBe(12345);
    expect(post.durationMs).toBe(213000);
  });

  it('facebook: un video, letto da video.hd_url/sd_url e non da videoDetails', async () => {
    // Stessa lezione dell'Instagram sopra: verificato dal vivo, il campo vero è `video.hd_url`.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        success: true,
        post_id: 'fb1',
        description: 'a video post',
        like_count: 10,
        comment_count: 2,
        view_count: 500,
        creation_time: '2020-01-01T00:00:00.000Z',
        video: { sd_url: 'https://cdn/sd.mp4', hd_url: 'https://cdn/hd.mp4' }
      })
    );

    const post = await fetchSinglePost('facebook', 'https://www.facebook.com/watch/?v=fb1');
    expect(post.mediaType).toBe('video');
    expect(post.videoUrl).toBe('https://cdn/hd.mp4');
    expect(post.metrics.views).toBe(500);
  });

  it('una piattaforma non cablata rifiuta esplicitamente, non torna un post vuoto', async () => {
    await expect(fetchSinglePost('linkedin', 'https://linkedin.com/company/nike')).rejects.toThrow(/not supported/);
  });

  it('un 404 dal provider propaga l\'errore, non un post finto', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' });
    await expect(fetchSinglePost('instagram', 'https://www.instagram.com/p/DOESNOTEXIST/')).rejects.toThrow();
  });
});
