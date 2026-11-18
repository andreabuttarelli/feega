import { describe, expect, it } from 'vitest';
import { fieldValue, productItem, socialPostItem, type ProductRow } from './select-sources';

describe('campi del prodotto per le uscite del select', () => {
  const runner = {
    title: 'Tree Runner',
    description: null,
    images: [],
    price: 98,
    compareAtPrice: 140,
    tags: ['sale', 'running'],
    vendor: 'Allbirds',
    productType: 'Shoes',
    sku: 'TR-R-9',
    variants: [
      { id: '1', title: 'Red / 9', sku: 'TR-R-9', price: 98, compare_at_price: 140, available: true, options: { Color: 'Red', Size: '9' }, image: null },
      { id: '2', title: 'Blue / 10', sku: null, price: 98, compare_at_price: null, available: false, options: { Color: 'Blue', Size: '10' }, image: null }
    ],
    options: { Color: ['Red', 'Blue'], Size: ['9', '10'] }
  };
  const value = (key: string, row: ProductRow = runner) => fieldValue('products', key, row)?.text;

  it('prezzo barrato e sconto calcolato', () => {
    expect(value('compare_at_price')).toBe('140');
    expect(value('discount_percent')).toBe('30');
  });

  it('senza barrato lo sconto è vuoto, non zero', () => {
    expect(value('discount_percent', { ...runner, compareAtPrice: null })).toBeNull();
  });

  it('tag, marca, tipo, sku', () => {
    expect(value('tags')).toBe('sale, running');
    expect(value('vendor')).toBe('Allbirds');
    expect(value('product_type')).toBe('Shoes');
    expect(value('sku')).toBe('TR-R-9');
  });

  it('varianti e opzioni come testo leggibile', () => {
    expect(value('variants')).toBe('Red / 9, Blue / 10 (sold out)');
    expect(value('options')).toBe('Color: Red, Blue\nSize: 9, 10');
  });

  it('un prodotto sincronizzato prima dei campi nuovi non rompe nulla', () => {
    const old = { title: 'x', description: null, images: [] };
    for (const key of ['compare_at_price', 'discount_percent', 'tags', 'vendor', 'product_type', 'sku', 'variants', 'options']) {
      expect(value(key, old)).toBeNull();
    }
  });
});

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
