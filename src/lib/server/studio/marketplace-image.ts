import sharp from 'sharp';
import { MARKETPLACES, type Marketplace } from '$lib/studio/marketplace';

const JPEG_QUALITY = 90;

export type MarketplaceFile = { bytes: Uint8Array; extension: string; mimeType: string };

export async function toMarketplace(source: Uint8Array, market: Marketplace): Promise<MarketplaceFile> {
  const spec = MARKETPLACES[market];
  const bytes = await sharp(source)
    .rotate()
    .flatten({ background: spec.background })
    .resize(spec.width, spec.height, { fit: spec.fit, background: spec.background })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return { bytes: new Uint8Array(bytes), extension: 'jpg', mimeType: 'image/jpeg' };
}
