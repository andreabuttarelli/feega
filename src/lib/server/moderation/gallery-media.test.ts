import { describe, expect, it } from 'vitest';
import { GALLERY_MEDIA_REFUSAL, MediaVerdict, parseMediaVerdict, screenGalleryMedia } from './gallery-media';
import { ReferenceMedium } from './people';

const picture = { medium: ReferenceMedium.Image, url: 'https://x/a.png' };

describe('the media check of the public gallery', () => {
  it('reads the verdict out of a chatty answer, and a broken one as unknown', () => {
    expect(parseMediaVerdict('Sure: {"allowed": true, "why": "a logo"}')).toBe(MediaVerdict.Allowed);
    expect(parseMediaVerdict('{"allowed": false}')).toBe(MediaVerdict.Refused);
    expect(parseMediaVerdict('no idea')).toBe(MediaVerdict.Unknown);
  });

  it('passes with nothing to look at', async () => {
    expect(await screenGalleryMedia(async () => MediaVerdict.Refused, [])).toEqual({ ok: true });
  });

  it('refuses when one picture is refused or cannot be judged', async () => {
    expect(await screenGalleryMedia(async () => MediaVerdict.Refused, [picture])).toEqual({ ok: false, error: GALLERY_MEDIA_REFUSAL });
    expect(await screenGalleryMedia(async () => MediaVerdict.Unknown, [picture])).toEqual({ ok: false, error: GALLERY_MEDIA_REFUSAL });
  });

  it('a judge that is down refuses as unavailable, never lets it through', async () => {
    const outcome = await screenGalleryMedia(async () => {
      throw new Error('timeout');
    }, [picture]);
    expect(outcome).toMatchObject({ ok: false, unavailable: true });
  });
});
