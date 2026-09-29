import { describe, expect, it } from 'vitest';
import { productItem, socialPostItem } from './select-sources';

describe('productItem — un prodotto come item di select', () => {
  it('titolo e descrizione uniti in un testo, le foto come media', () => {
    const item = productItem({
      title: 'Sedia rossa',
      description: 'Comoda e leggera',
      images: [{ url: 'https://cdn/1.jpg' }, { url: 'https://cdn/2.jpg' }]
    });

    expect(item).toEqual({ text: 'Sedia rossa\n\nComoda e leggera', mediaUrls: ['https://cdn/1.jpg', 'https://cdn/2.jpg'] });
  });

  it('senza descrizione, solo il titolo', () => {
    const item = productItem({ title: 'Sedia rossa', description: null, images: [] });
    expect(item).toEqual({ text: 'Sedia rossa', mediaUrls: [] });
  });
});

describe('socialPostItem — un post come item di select', () => {
  it('la didascalia e la copertina quando non ci sono slide', () => {
    const item = socialPostItem({ caption: 'Buongiorno', media: { thumbnailUrl: 'https://cdn/t.jpg' } });
    expect(item).toEqual({ text: 'Buongiorno', mediaUrls: ['https://cdn/t.jpg'] });
  });

  it('un carosello dà tutte le slide, nel loro ordine', () => {
    const item = socialPostItem({
      caption: null,
      media: {
        items: [
          { type: 'image', url: 'https://cdn/s1.jpg' },
          { type: 'image', url: 'https://cdn/s2.jpg' }
        ]
      }
    });
    expect(item).toEqual({ text: null, mediaUrls: ['https://cdn/s1.jpg', 'https://cdn/s2.jpg'] });
  });

  it('una slide senza url usa il suo thumbnail', () => {
    const item = socialPostItem({
      caption: null,
      media: { items: [{ type: 'video', thumbnailUrl: 'https://cdn/thumb.jpg' }] }
    });
    expect(item).toEqual({ text: null, mediaUrls: ['https://cdn/thumb.jpg'] });
  });

  it('una slide video dà la sua copertina, non il file video', () => {
    const item = socialPostItem({
      caption: null,
      media: { items: [{ type: 'video', url: 'https://cdn/clip.mp4', thumbnailUrl: 'https://cdn/cover.jpg' }] }
    });
    expect(item.mediaUrls).toEqual(['https://cdn/cover.jpg']);
  });

  it('un post video senza slide dà la copertina, non il video', () => {
    const item = socialPostItem({ caption: null, media: { thumbnailUrl: 'https://cdn/cover.jpg', videoUrl: 'https://cdn/clip.mp4' } });
    expect(item.mediaUrls).toEqual(['https://cdn/cover.jpg']);
  });

  it('nessun media: array vuoto, non un errore', () => {
    expect(socialPostItem({ caption: 'solo testo', media: null })).toEqual({ text: 'solo testo', mediaUrls: [] });
  });
});
