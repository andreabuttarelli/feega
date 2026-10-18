import { describe, expect, it } from 'vitest';
import { MediaAccept, MediaKind, acceptOf, accepts, itemOfPick, linkOf, pickOfItem, setSlot, slotPick } from './pick';

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

describe('a list of media slots', () => {
  const LIST = [{ assetId: 'a', kind: 'image', fit: 'contain' }, { assetId: 'b', kind: 'video' }];

  it('replaces a slot keeping its look, removes one, appends past the end', () => {
    expect(setSlot(LIST, 0, { kind: MediaKind.Image, assetId: 'c' })[0]).toEqual({ assetId: 'c', kind: 'image', fit: 'contain' });
    expect(setSlot(LIST, 1, null)).toEqual([LIST[0]]);
    expect(setSlot(LIST, 2, { kind: MediaKind.Video, assetId: 'd' })).toHaveLength(3);
    expect(slotPick(LIST[1])).toEqual({ kind: MediaKind.Video, assetId: 'b' });
  });

  it('reads which kinds a slot accepts from its asset kind', () => {
    expect(acceptOf('video')).toBe(MediaAccept.Video);
    expect(acceptOf('image')).toBe(MediaAccept.Image);
    expect(acceptOf(undefined)).toBe(MediaAccept.Any);
  });
});
