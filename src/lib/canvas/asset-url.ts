export enum AssetSize {
  Thumb = 'thumb',
  Px256 = '256',
  Px512 = '512',
  Px1024 = '1024',
  Px2048 = '2048',
  Full = 'full'
}

export type Tier = AssetSize.Px256 | AssetSize.Px512 | AssetSize.Px1024 | AssetSize.Px2048 | AssetSize.Full;

export const TIERS: readonly Tier[] = [AssetSize.Px256, AssetSize.Px512, AssetSize.Px1024, AssetSize.Px2048, AssetSize.Full];

export const ORIGINAL_PX_ESTIMATE = 4096;

export const TIER_PX: Record<Tier, number> = {
  [AssetSize.Px256]: 256,
  [AssetSize.Px512]: 512,
  [AssetSize.Px1024]: 1024,
  [AssetSize.Px2048]: 2048,
  [AssetSize.Full]: ORIGINAL_PX_ESTIMATE
};

const SIZE_PARAM = 'size';
const CANVAS_ASSET_PATH = /^(\/p\/[^/?#]+\/c\/[^/?#]+\/assets\/[^/?#]+)(\?[^#]*)?$/;

function isAssetSize(value: string | null): value is AssetSize {
  return Object.values(AssetSize).includes(value as AssetSize);
}

function withSize(path: string, size: AssetSize): string {
  return size === AssetSize.Full ? path : `${path}?${SIZE_PARAM}=${size}`;
}

export function canvasAssetUrl(projectId: string, canvasId: string, assetId: string, size: AssetSize): string {
  return withSize(`/p/${projectId}/c/${canvasId}/assets/${assetId}`, size);
}

export function sized(url: string, size: AssetSize): string {
  const match = CANVAS_ASSET_PATH.exec(url);
  return match ? withSize(match[1], size) : url;
}

export function sizeOf(url: URL): AssetSize {
  const size = url.searchParams.get(SIZE_PARAM);
  return isAssetSize(size) ? size : AssetSize.Full;
}
