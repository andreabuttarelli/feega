import { describe, expect, it } from 'vitest';
import { SOURCE_ITEM_FIELDS, fieldValue, type PostRow, type ProductRow } from './select-sources';

const CAROUSEL: PostRow = {
  caption: 'New drop #run #nike',
  media: {
    items: [
      { type: 'image', url: 'https://cdn/s1.jpg' },
      { type: 'video', url: 'https://cdn/s2.mp4', thumbnailUrl: 'https://cdn/s2.jpg' }
    ],
    hashtags: ['run', 'nike']
  },
  metrics: { likes: 1200, views: null, comments: 34 },
  permalink: 'https://instagram.com/p/1',
  postedAt: '2026-09-01T10:00:00Z',
  handle: 'nike'
};

const VIDEO_POST: PostRow = {
  caption: 'Just do it',
  media: { thumbnailUrl: 'https://cdn/cover.jpg', videoUrl: 'https://cdn/clip.mp4' },
  metrics: { views: 50000 },
  permalink: null,
  postedAt: null,
  handle: 'nike'
};

const PRODUCT: ProductRow = {
  title: 'Tree Runner',
  description: 'Light and breathable',
  price: 98,
  currency: 'USD',
  url: 'https://allbirds.com/products/tree-runner',
  handle: 'tree-runner',
  available: true,
  images: [{ url: 'https://cdn/p1.jpg' }, { url: 'https://cdn/p2.jpg' }]
};

const NO_IMAGES: ProductRow = { ...PRODUCT, description: null, price: null, images: [] };

const post = (key: string, row: PostRow) => fieldValue('social_account_feed', key, row)!;
const product = (key: string, row: ProductRow) => fieldValue('products', key, row)!;

describe('SOURCE_ITEM_FIELDS — la tabella dei campi per sorgente', () => {
  it('ogni campo ha chiave unica, etichetta e una porta di uscita', () => {
    for (const fields of Object.values(SOURCE_ITEM_FIELDS)) {
      const keys = fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const f of fields) {
        expect(f.label.length).toBeGreaterThan(0);
        expect(['text', 'images', 'videos']).toContain(f.port);
      }
    }
  });

  it('i prodotti espongono foto, prima foto, titolo, descrizione, prezzo, valuta, url', () => {
    const keys = SOURCE_ITEM_FIELDS.products.map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(['images', 'first_image', 'title', 'description', 'price', 'currency', 'url']));
  });

  it('il feed espone media, prima slide, video, didascalia, hashtag, metriche, data, url, autore', () => {
    const keys = SOURCE_ITEM_FIELDS.social_account_feed.map((f) => f.key);
    expect(keys).toEqual(
      expect.arrayContaining(['media', 'first_slide', 'video', 'caption', 'hashtags', 'likes', 'views', 'comments', 'posted_at', 'url', 'author'])
    );
  });

  it('un campo che la sorgente non ha non ha valore', () => {
    expect(fieldValue('social_account_feed', 'price', CAROUSEL)).toBeNull();
  });
});

describe('estrattori sul feed', () => {
  it('un carosello dà tutte le slide, e la prima da sola', () => {
    expect(post('media', CAROUSEL).mediaUrls).toEqual(['https://cdn/s1.jpg', 'https://cdn/s2.jpg']);
    expect(post('first_slide', CAROUSEL).mediaUrls).toEqual(['https://cdn/s1.jpg']);
  });

  it('un post video dà la clip sul campo video e la copertina sui media', () => {
    expect(post('video', VIDEO_POST).mediaUrls).toEqual(['https://cdn/clip.mp4']);
    expect(post('media', VIDEO_POST).mediaUrls).toEqual(['https://cdn/cover.jpg']);
  });

  it('le slide video di un carosello sono il campo video', () => {
    expect(post('video', CAROUSEL).mediaUrls).toEqual(['https://cdn/s2.mp4']);
  });

  it('le metriche diventano testo, una metrica assente è niente', () => {
    expect(post('likes', CAROUSEL).text).toBe('1200');
    expect(post('views', CAROUSEL).text).toBeNull();
    expect(post('views', VIDEO_POST).text).toBe('50000');
  });

  it("gli hashtag, la didascalia, l'autore", () => {
    expect(post('hashtags', CAROUSEL).text).toBe('#run #nike');
    expect(post('caption', CAROUSEL).text).toBe('New drop #run #nike');
    expect(post('author', CAROUSEL).text).toBe('@nike');
  });

  it('senza hashtag salvati li legge dalla didascalia', () => {
    expect(post('hashtags', { ...CAROUSEL, media: {} }).text).toBe('#run #nike');
  });
});

describe('estrattori sui prodotti', () => {
  it('prezzo e valuta separati, la prima foto da sola', () => {
    expect(product('price', PRODUCT).text).toBe('98');
    expect(product('currency', PRODUCT).text).toBe('USD');
    expect(product('first_image', PRODUCT).mediaUrls).toEqual(['https://cdn/p1.jpg']);
    expect(product('images', PRODUCT).mediaUrls).toEqual(['https://cdn/p1.jpg', 'https://cdn/p2.jpg']);
  });

  it('un prodotto senza foto e senza prezzo non dà niente, non un valore inventato', () => {
    expect(product('first_image', NO_IMAGES).mediaUrls).toEqual([]);
    expect(product('price', NO_IMAGES).text).toBeNull();
    expect(product('description', NO_IMAGES).text).toBeNull();
  });
});
