import { describe, expect, it, vi } from 'vitest';
import tiktok from './fixtures/social-search-tiktok.json';
import instagram from './fixtures/social-search-instagram.json';
import youtube from './fixtures/social-search-youtube.json';
import { SOCIAL_MAX_CLIPS, SocialPlatform, socialSearch, type SocialGet } from './social-search';

const answering = (page: unknown): SocialGet => vi.fn().mockResolvedValueOnce(page);

describe('social search', () => {
  it('tiktok returns videos with cover, playable url, author and views', async () => {
    const get = answering(tiktok);

    const found = await socialSearch(get, SocialPlatform.TikTok, 'motion design', 5);

    expect(get).toHaveBeenCalledWith('/v1/tiktok/search/keyword?query=motion+design');
    expect(found).toMatchObject({ ok: true, requests: 1 });
    expect(found.ok && found.clips[0]).toMatchObject({
      platform: 'tiktok',
      id: '7689452266989866272',
      url: expect.stringContaining('tiktok.com/@mjbiagioni/video/7689452266989866272'),
      caption: expect.stringContaining('moving countries'),
      thumbnail: expect.stringContaining('tiktokcdn'),
      video: expect.stringMatching(/^https:/),
      author: 'mjbiagioni',
      views: 1634,
      seconds: 46
    });
  });

  it('instagram returns reels', async () => {
    const get = answering(instagram);

    const found = await socialSearch(get, SocialPlatform.Instagram, 'motion design', 5);

    expect(get).toHaveBeenCalledWith('/v2/instagram/reels/search?query=motion+design');
    expect(found.ok && found.clips[1]).toMatchObject({
      platform: 'instagram',
      id: '3994951850807503693',
      url: 'https://www.instagram.com/reel/Ddw64rKK6tN/',
      author: 'higgsfield.ai',
      views: 452112,
      likes: 44946,
      seconds: 73,
      publishedAt: '2026-09-26T20:44:53.000Z',
      video: expect.stringMatching(/^https:/),
      thumbnail: expect.stringMatching(/^https:/)
    });
  });

  it('youtube returns videos with no playable url', async () => {
    const get = answering(youtube);

    const found = await socialSearch(get, SocialPlatform.YouTube, 'motion design', 5);

    expect(get).toHaveBeenCalledWith('/v1/youtube/search?query=motion+design');
    expect(found.ok && found.clips[0]).toEqual({
      platform: 'youtube',
      id: 'OIAWkkSO4WY',
      url: 'https://www.youtube.com/watch?v=OIAWkkSO4WY',
      caption: 'Claude Opus 5.5 Is INSANE at Motion Graphics',
      thumbnail: expect.stringContaining('i.ytimg.com'),
      video: null,
      author: 'RandomAI_ss',
      views: 181925,
      likes: null,
      seconds: 710,
      publishedAt: '2026-10-03T10:32:58.936Z'
    });
  });

  it('keeps at most the limit, never more than the cap', async () => {
    const one = await socialSearch(answering(instagram), SocialPlatform.Instagram, 'q', 1);
    const many = await socialSearch(answering(instagram), SocialPlatform.Instagram, 'q', 1000);

    expect(one.ok && one.clips).toHaveLength(1);
    expect(many.ok && many.clips.length).toBeLessThanOrEqual(SOCIAL_MAX_CLIPS);
  });

  it('a failed request is an error that still counts the request', async () => {
    const get: SocialGet = vi.fn().mockRejectedValueOnce(new Error('HTTP 500'));

    expect(await socialSearch(get, SocialPlatform.TikTok, 'q', 5)).toEqual({ ok: false, error: 'tiktok search failed: HTTP 500', requests: 1 });
  });
});
