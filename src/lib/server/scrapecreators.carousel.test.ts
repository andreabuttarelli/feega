/**
 * `items` è la lista ordinata di ogni slide di un post — Instagram (`carousel_media`), TikTok
 * (`image_post_info.images`) e X (`extended_entities.media`) possono tornare più di una foto o
 * clip per post, e prima di questo file solo la prima sopravviveva: `mediaOf` in
 * `repos/social-posts.ts` leggeva solo `thumbnailUrl`, il resto del carosello si perdeva a monte,
 * dentro il mapper stesso.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { envMock } = vi.hoisted(() => ({ envMock: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));

import { fetchProfileHistory } from './scrapecreators';

beforeEach(() => {
  vi.clearAllMocks();
  envMock.SCRAPECREATORS_API_KEY = 'test-key';
  vi.stubGlobal('fetch', vi.fn());
});

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
}

describe('instagram carousel_media', () => {
  it('mappa ogni slide del carosello in items, nell\'ordine ricevuto', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        items: [
          {
            pk: '1',
            url: 'https://instagram.com/p/1',
            caption: { text: 'swipe' },
            media_type: 8,
            carousel_media: [
              { media_type: 1, image_versions2: { candidates: [{ url: 'https://cdn/slide1.jpg' }] } },
              {
                media_type: 2,
                image_versions2: { candidates: [{ url: 'https://cdn/slide2-cover.jpg' }] },
                video_versions: [{ url: 'https://cdn/slide2.mp4' }]
              }
            ],
            taken_at: 1700000000,
            like_count: 5,
            comment_count: 1
          }
        ],
        more_available: false
      })
    );

    const [post] = await fetchProfileHistory('instagram', { username: 'brand', profileUrl: null });

    expect(post.items).toEqual([
      { type: 'image', url: 'https://cdn/slide1.jpg', thumbnailUrl: 'https://cdn/slide1.jpg' },
      { type: 'video', url: 'https://cdn/slide2.mp4', thumbnailUrl: 'https://cdn/slide2-cover.jpg' }
    ]);
    expect(post.thumbnailUrl).toBe('https://cdn/slide1.jpg');
  });

  it('un post senza carosello resta un items di un solo elemento', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        items: [
          {
            pk: '2',
            media_type: 1,
            image_versions2: { candidates: [{ url: 'https://cdn/only.jpg' }] },
            taken_at: 1700000000
          }
        ],
        more_available: false
      })
    );

    const [post] = await fetchProfileHistory('instagram', { username: 'brand', profileUrl: null });
    expect(post.items).toEqual([{ type: 'image', url: 'https://cdn/only.jpg', thumbnailUrl: 'https://cdn/only.jpg' }]);
  });
});

describe('tiktok image_post_info', () => {
  it('mappa ogni immagine di un post-foto TikTok in items', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        aweme_list: [
          {
            aweme_id: '9',
            desc: 'slideshow',
            create_time: 1700000000,
            image_post_info: {
              images: [
                { display_image: { url_list: ['https://cdn/tt1.jpg'] } },
                { display_image: { url_list: ['https://cdn/tt2.jpg'] } }
              ]
            }
          }
        ],
        has_more: false
      })
    );

    const [post] = await fetchProfileHistory('tiktok', { username: 'brand', profileUrl: null });
    expect(post.items).toEqual([
      { type: 'image', url: 'https://cdn/tt1.jpg', thumbnailUrl: 'https://cdn/tt1.jpg' },
      { type: 'image', url: 'https://cdn/tt2.jpg', thumbnailUrl: 'https://cdn/tt2.jpg' }
    ]);
  });

  it('un video normale (senza image_post_info) resta un items di un solo elemento video', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        aweme_list: [
          {
            aweme_id: '10',
            create_time: 1700000000,
            video: {
              cover: { url_list: ['https://cdn/cover.jpg'] },
              play_addr: { url_list: ['https://cdn/clip.mp4'] }
            }
          }
        ],
        has_more: false
      })
    );

    const [post] = await fetchProfileHistory('tiktok', { username: 'brand', profileUrl: null });
    expect(post.items).toEqual([{ type: 'video', url: 'https://cdn/clip.mp4', thumbnailUrl: 'https://cdn/cover.jpg' }]);
  });
});

describe('x extended_entities.media', () => {
  it('mappa ogni foto di un tweet multi-immagine in items', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        tweets: [
          {
            rest_id: '5',
            url: 'https://x.com/brand/status/5',
            legacy: {
              full_text: 'gallery',
              created_at: 'Wed Oct 10 20:19:24 +0000 2018',
              extended_entities: {
                media: [
                  { type: 'photo', media_url_https: 'https://cdn/x1.jpg' },
                  { type: 'photo', media_url_https: 'https://cdn/x2.jpg' }
                ]
              }
            }
          }
        ]
      })
    );

    const [post] = await fetchProfileHistory('x', { username: 'brand', profileUrl: null });
    expect(post.items).toEqual([
      { type: 'image', url: 'https://cdn/x1.jpg', thumbnailUrl: 'https://cdn/x1.jpg' },
      { type: 'image', url: 'https://cdn/x2.jpg', thumbnailUrl: 'https://cdn/x2.jpg' }
    ]);
  });
});
