import { describe, expect, it } from 'vitest';
import { MediaAccept, MediaKind, accepts, itemOfPick, linkOf, pickOfItem } from './pick';

describe('a single media value, as an asset id or a link', () => {
  it('reads an asset id, a video id and a link without changing what is stored', () => {
    expect(pickOfItem('abc')).toEqual({ kind: MediaKind.Image, assetId: 'abc' });
    expect(pickOfItem('video:abc')).toEqual({ kind: MediaKind.Video, assetId: 'abc' });
    expect(pickOfItem('https://cdn.test/a.jpg')).toEqual({ kind: MediaKind.Image, url: 'https://cdn.test/a.jpg' });
    expect(pickOfItem('')).toBeNull();
    expect(pickOfItem(null)).toBeNull();
  });

  it('writes back the same strings old documents hold', () => {
    for (const raw of ['abc', 'video:abc', 'https://cdn.test/a.jpg', 'video:https://cdn.test/a.mp4']) {
      expect(itemOfPick(pickOfItem(raw))).toBe(raw);
    }
    expect(itemOfPick(null)).toBe('');
  });

  it('accepts only http links and guesses a video from its extension', () => {
    expect(linkOf('  https://cdn.test/clip.mp4?x=1 ')).toEqual({ ok: true, url: 'https://cdn.test/clip.mp4?x=1', kind: MediaKind.Video });
    expect(linkOf('http://cdn.test/a.png')).toEqual({ ok: true, url: 'http://cdn.test/a.png', kind: MediaKind.Image });
    expect(linkOf('ftp://x/a.png').ok).toBe(false);
    expect(linkOf('not a link').ok).toBe(false);
  });

  it('tells which kinds a slot takes', () => {
    expect(accepts(MediaAccept.Image, MediaKind.Video)).toBe(false);
    expect(accepts(MediaAccept.Any, MediaKind.Video)).toBe(true);
    expect(accepts(MediaAccept.Video, MediaKind.Video)).toBe(true);
  });
});
