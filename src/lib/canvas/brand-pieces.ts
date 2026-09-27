import { colourDrag, handleDrag, staticDocData, staticMediaData, staticTextData, type FilledNodeDrag } from './drag-payload';
import { genNodeSize } from './gen-node';
import { docNodeSize } from './doc-node';
import { iframeNodeSize } from './iframe-node';
import { isProductPlatform, productsNodeSize } from './products-node';

export type BrandPiece =
  | { kind: 'logo'; assetId: string; name: string }
  | { kind: 'name'; text: string }
  | { kind: 'description'; text: string }
  | { kind: 'content'; markdown: string }
  | { kind: 'colour'; hex: string; assetId: string; url: string }
  | { kind: 'handle'; platform: string; handle: string }
  | { kind: 'store'; platform: string; url: string }
  | { kind: 'website'; url: string };

export type BrandPieceKind = BrandPiece['kind'];

type PieceOf<K extends BrandPieceKind> = Extract<BrandPiece, { kind: K }>;

const PIECE_DRAG: { [K in BrandPieceKind]: (piece: PieceOf<K>) => FilledNodeDrag | null } = {
  logo: (p) => ({
    type: 'image',
    data: staticMediaData({ assetId: p.assetId, url: '', name: p.name, mimeType: 'image/*' }),
    ...genNodeSize('image')
  }),
  name: (p) => ({ type: 'text', data: staticTextData(p.text), ...genNodeSize('text') }),
  description: (p) => ({ type: 'text', data: staticTextData(p.text), ...genNodeSize('text') }),
  content: (p) => ({ type: 'doc', data: staticDocData(p.markdown), ...docNodeSize() }),
  colour: (p) => colourDrag(p),
  handle: (p) => handleDrag(p),
  store: (p) => (isProductPlatform(p.platform) ? { type: 'products', data: { type: p.platform, url: p.url }, ...productsNodeSize() } : null),
  website: (p) => ({ type: 'iframe', data: { url: p.url }, ...iframeNodeSize() })
};

export const BRAND_PIECE_KINDS = Object.keys(PIECE_DRAG) as BrandPieceKind[];

export function pieceDrag(piece: BrandPiece): FilledNodeDrag | null {
  const build = PIECE_DRAG[piece.kind] as (p: BrandPiece) => FilledNodeDrag | null;
  return build(piece);
}

export type PanelBrandBase = {
  name: string;
  logoAssetId: string | null;
  shortDescription: string | null;
  content: string | null;
};

export type BrandDetails = {
  website: string | null;
  colours: Array<{ hex: string; assetId: string | null; url: string | null }>;
  handles: Array<{ platform: string; handle: string }>;
  stores: Array<{ platform: string; url: string }>;
};

export function brandPieces(brand: PanelBrandBase, details: BrandDetails): BrandPiece[] {
  const pieces: Array<BrandPiece | null> = [
    brand.logoAssetId ? { kind: 'logo', assetId: brand.logoAssetId, name: `${brand.name} logo` } : null,
    { kind: 'name', text: brand.name },
    brand.shortDescription ? { kind: 'description', text: brand.shortDescription } : null,
    brand.content ? { kind: 'content', markdown: brand.content } : null,
    ...details.colours.map((c): BrandPiece | null =>
      c.assetId && c.url ? { kind: 'colour', hex: c.hex, assetId: c.assetId, url: c.url } : null
    ),
    ...details.handles.map((h): BrandPiece => ({ kind: 'handle', platform: h.platform, handle: h.handle })),
    ...details.stores.map((s): BrandPiece => ({ kind: 'store', platform: s.platform, url: s.url })),
    details.website ? { kind: 'website', url: details.website } : null
  ];

  return pieces.filter((p): p is BrandPiece => p !== null && pieceDrag(p) !== null);
}
