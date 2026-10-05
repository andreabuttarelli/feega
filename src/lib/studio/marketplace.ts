export enum Marketplace {
  Amazon = 'amazon',
  Shopify = 'shopify',
  Instagram = 'instagram'
}

export enum Fit {
  Contain = 'contain',
  Cover = 'cover'
}

export type MarketplaceSpec = { label: string; size: string; width: number; height: number; fit: Fit; background: string };

export const MARKETPLACES: Readonly<Record<Marketplace, MarketplaceSpec>> = {
  [Marketplace.Amazon]: { label: 'Amazon', size: '2000 × 2000, white', width: 2000, height: 2000, fit: Fit.Contain, background: '#ffffff' },
  [Marketplace.Shopify]: { label: 'Shopify', size: '2048 × 2048', width: 2048, height: 2048, fit: Fit.Contain, background: '#ffffff' },
  [Marketplace.Instagram]: { label: 'Instagram', size: '1080 × 1350, 4:5', width: 1080, height: 1350, fit: Fit.Cover, background: '#ffffff' }
};

export function isMarketplace(value: string | null): value is Marketplace {
  return value !== null && value in MARKETPLACES;
}
