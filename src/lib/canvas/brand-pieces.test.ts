import { describe, expect, it } from 'vitest';
import { BRAND_PIECE_KINDS, brandPieces, pieceDrag, type BrandPiece } from './brand-pieces';
import { parseFilledNodeDrag, serializeFilledNodeDrag } from './drag-payload';
import { validateNodeData } from './node-data';

const BRAND = {
  name: 'Acme',
  logoAssetId: 'logo-asset',
  shortDescription: 'Coffee for everyone',
  content: '## Colours\n\n- #112233'
};

const DETAILS = {
  website: 'https://acme.example',
  colours: [{ hex: '#112233', assetId: 'swatch-asset', url: 'https://public.example/swatch.png' }],
  handles: [{ platform: 'instagram', handle: 'acme' }],
  stores: [{ platform: 'shopify', url: 'https://acme.myshopify.com' }]
};

const SAMPLE: { [K in BrandPiece['kind']]: Extract<BrandPiece, { kind: K }> } = {
  logo: { kind: 'logo', assetId: 'logo-asset', name: 'Acme logo' },
  name: { kind: 'name', text: 'Acme' },
  description: { kind: 'description', text: 'Coffee for everyone' },
  content: { kind: 'content', markdown: '# Acme' },
  colour: { kind: 'colour', hex: '#112233', assetId: 'swatch-asset', url: 'https://public.example/swatch.png' },
  handle: { kind: 'handle', platform: 'instagram', handle: 'acme' },
  store: { kind: 'store', platform: 'shopify', url: 'https://acme.myshopify.com' },
  website: { kind: 'website', url: 'https://acme.example' }
};

const EXPECTED_NODE: Record<BrandPiece['kind'], string> = {
  logo: 'image',
  name: 'text',
  description: 'text',
  content: 'doc',
  colour: 'image',
  handle: 'social_account_feed',
  store: 'products',
  website: 'iframe'
};

describe('ogni pezzo di un brand diventa il nodo giusto', () => {
  it.each(BRAND_PIECE_KINDS)('%s ha un nodo, e il suo data passa validateNodeData', (kind) => {
    const drag = pieceDrag(SAMPLE[kind]);
    expect(drag?.type).toBe(EXPECTED_NODE[kind]);
    expect(validateNodeData(drag!.type, drag!.data).ok).toBe(true);
    expect(parseFilledNodeDrag(serializeFilledNodeDrag(drag!))).toEqual(drag);
  });

  it('nessun pezzo porta un url firmato nel nodo', () => {
    const signed = 'https://x.supabase.co/storage/v1/object/sign/media/a.png?token=t';
    const drag = pieceDrag({ kind: 'colour', hex: '#000', assetId: 'a', url: signed });
    expect(JSON.stringify(drag?.data)).not.toContain('/sign/');
    expect(drag?.data).toMatchObject({ assetId: 'a' });
  });

  it('il nome e la descrizione sono due nodi text separati', () => {
    expect(pieceDrag(SAMPLE.name)?.data).toEqual({ prompt: 'Acme' });
    expect(pieceDrag(SAMPLE.description)?.data).toEqual({ prompt: 'Coffee for everyone' });
  });

  it('un handle arriva come feed già compilato, uno store come nodo products già compilato', () => {
    expect(pieceDrag(SAMPLE.handle)?.data).toEqual({ platform: 'instagram', handle: 'acme' });
    expect(pieceDrag(SAMPLE.store)?.data).toEqual({ type: 'shopify', url: 'https://acme.myshopify.com' });
    expect(pieceDrag(SAMPLE.website)?.data).toEqual({ url: 'https://acme.example' });
  });

  it('una piattaforma fuori tabella non diventa un nodo', () => {
    expect(pieceDrag({ kind: 'handle', platform: 'myspace', handle: 'a' })).toBeNull();
    expect(pieceDrag({ kind: 'store', platform: 'magento', url: 'https://a.example' })).toBeNull();
  });
});

describe('brandPieces: tutto quello che il brand ha, e solo quello', () => {
  it('elenca ogni pezzo presente, nell ordine della tabella', () => {
    const kinds = brandPieces(BRAND, DETAILS).map((p) => p.kind);
    expect(kinds).toEqual(['logo', 'name', 'description', 'content', 'colour', 'handle', 'store', 'website']);
  });

  it('un brand con solo il nome ha solo il nome', () => {
    const pieces = brandPieces(
      { name: 'Bare', logoAssetId: null, shortDescription: null, content: null },
      { website: null, colours: [], handles: [], stores: [] }
    );
    expect(pieces).toEqual([{ kind: 'name', text: 'Bare' }]);
  });

  it('un colore senza swatch pronto non compare: non si potrebbe trascinare', () => {
    const pieces = brandPieces(BRAND, { ...DETAILS, colours: [{ hex: '#fff', assetId: null, url: null }] });
    expect(pieces.some((p) => p.kind === 'colour')).toBe(false);
  });
});
