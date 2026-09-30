import { describe, expect, it } from 'vitest';
import { normaliseProduct } from './store-product';

const SHOPIFY_CTX = { origin: 'https://shop.example.com', divisor: 1, onlyFirstPhoto: false };
const WOO_CTX = { origin: 'https://woo.example.com', divisor: 100, onlyFirstPhoto: false };

const shopifyRunner = {
  id: 6932119633,
  title: 'Tree Runner',
  handle: 'tree-runner',
  body_html: '<p>Light shoe</p>',
  vendor: 'Allbirds',
  product_type: 'Shoes',
  tags: 'sale, running,  men ',
  variants: [
    { id: 111, title: 'Red / 9', sku: 'TR-R-9', price: '98.00', compare_at_price: '140.00', available: true, option1: 'Red', option2: '9', option3: null, featured_image: { src: 'https://cdn.example.com/red.jpg' } },
    { id: 112, title: 'Blue / 10', sku: 'TR-B-10', price: '98.00', compare_at_price: null, available: false, option1: 'Blue', option2: '10', option3: null, featured_image: null }
  ],
  options: [
    { name: 'Color', position: 1, values: ['Red', 'Blue'] },
    { name: 'Size', position: 2, values: ['9', '10'] }
  ],
  images: [{ src: 'https://cdn.example.com/1.jpg' }]
};

const wooHoodie = {
  id: 34,
  name: 'Hoodie &amp; Zip',
  slug: 'hoodie',
  permalink: 'https://woo.example.com/product/hoodie/',
  sku: 'woo-hoodie',
  short_description: '<p>Warm</p>',
  on_sale: true,
  is_in_stock: true,
  prices: { price: '4200', regular_price: '4500', sale_price: '4200', currency_code: 'USD', currency_minor_unit: 2 },
  categories: [
    { id: 1, name: 'Hoodies', slug: 'hoodies' },
    { id: 2, name: 'Clothing', slug: 'clothing' }
  ],
  tags: [{ id: 7, name: 'winter', slug: 'winter' }],
  brands: [{ id: 9, name: 'Acme', slug: 'acme' }],
  attributes: [
    { id: 1, name: 'Color', taxonomy: 'pa_color', has_variations: true, terms: [{ id: 1, name: 'Blue', slug: 'blue' }, { id: 2, name: 'Green', slug: 'green' }] },
    { id: 0, name: 'Logo', taxonomy: null, has_variations: true, terms: [{ id: 0, name: 'Yes', slug: 'Yes' }, { id: 0, name: 'No', slug: 'No' }] }
  ],
  variations: [
    { id: 35, attributes: [{ name: 'Color', value: 'blue' }, { name: 'Logo', value: 'Yes' }] },
    { id: 36, attributes: [{ name: 'Color', value: 'green' }, { name: 'Logo', value: 'No' }] }
  ],
  images: [{ src: 'https://woo.example.com/hoodie.jpg' }]
};

describe('normaliser Shopify', () => {
  const product = normaliseProduct('shopify', shopifyRunner, SHOPIFY_CTX);

  it('legge prezzo e prezzo barrato dalla prima variante', () => {
    expect(product.price).toBe(98);
    expect(product.compareAtPrice).toBe(140);
    expect(product.sku).toBe('TR-R-9');
  });

  it('i tag separati da virgola diventano una lista pulita', () => {
    expect(product.tags).toEqual(['sale', 'running', 'men']);
  });

  it('i tag già in lista restano una lista', () => {
    expect(normaliseProduct('shopify', { ...shopifyRunner, tags: ['a', ' b '] }, SHOPIFY_CTX).tags).toEqual(['a', 'b']);
  });

  it('vendor, tipo e opzioni', () => {
    expect(product.vendor).toBe('Allbirds');
    expect(product.productType).toBe('Shoes');
    expect(product.options).toEqual({ Color: ['Red', 'Blue'], Size: ['9', '10'] });
  });

  it('ogni variante porta le sue opzioni per nome', () => {
    expect(product.variants).toEqual([
      { id: '111', title: 'Red / 9', sku: 'TR-R-9', price: 98, compare_at_price: 140, available: true, options: { Color: 'Red', Size: '9' }, image: 'https://cdn.example.com/red.jpg' },
      { id: '112', title: 'Blue / 10', sku: 'TR-B-10', price: 98, compare_at_price: null, available: false, options: { Color: 'Blue', Size: '10' }, image: null }
    ]);
  });

  it('senza disponibilità sul prodotto la dà una variante disponibile', () => {
    expect(product.available).toBe(true);
  });
});

describe('normaliser WooCommerce', () => {
  const product = normaliseProduct('woocommerce', wooHoodie, WOO_CTX);

  it('in saldo: prezzo attuale e prezzo pieno come barrato', () => {
    expect(product.price).toBe(42);
    expect(product.compareAtPrice).toBe(45);
  });

  it('fuori saldo non inventa un prezzo barrato', () => {
    const full = { ...wooHoodie, on_sale: false, prices: { ...wooHoodie.prices, price: '4500', sale_price: '4500' } };
    expect(normaliseProduct('woocommerce', full, WOO_CTX).compareAtPrice).toBeNull();
  });

  it('tag, marca, prima categoria come tipo, sku', () => {
    expect(product.tags).toEqual(['winter']);
    expect(product.vendor).toBe('Acme');
    expect(product.productType).toBe('Hoodies');
    expect(product.sku).toBe('woo-hoodie');
  });

  it('opzioni dagli attributi, varianti dalle variazioni senza prezzo inventato', () => {
    expect(product.options).toEqual({ Color: ['Blue', 'Green'], Logo: ['Yes', 'No'] });
    expect(product.variants).toEqual([
      { id: '35', title: 'blue / Yes', sku: null, price: null, compare_at_price: null, available: null, options: { Color: 'blue', Logo: 'Yes' }, image: null },
      { id: '36', title: 'green / No', sku: null, price: null, compare_at_price: null, available: null, options: { Color: 'green', Logo: 'No' }, image: null }
    ]);
  });

  it('un payload senza i campi nuovi torna vuoti, non errori', () => {
    const bare = normaliseProduct('woocommerce', { id: 1, name: 'x', prices: { price: '100' } }, WOO_CTX);
    expect(bare).toMatchObject({ compareAtPrice: null, tags: [], vendor: null, productType: null, sku: null, variants: [], options: {} });
  });
});
