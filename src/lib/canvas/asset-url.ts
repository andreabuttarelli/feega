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
export const ASSET_GRANT_PARAM = 'grant';

const ASSET_PATH = /^\/p\/[^/?#]+\/c\/[^/?#]+\/assets\/[^/?#]+$/;

const GRANTABLE: readonly RegExp[] = [
  ASSET_PATH,
  /^\/p\/[^/?#]+\/c\/[^/?#]+\/motion\/[^/?#]+\/(preview|live)$/,
  /^\/p\/[^/?#]+\/c\/[^/?#]+\/web-views\/[^/?#]+\/[^/?#]+$/,
  /^\/app\/studio\/[^/?#]+\/zip$/,
  /^\/account\/export$/
];
const ASSET_PATH_IN_TEXT = /"(\/p\/[^/"?#]+\/c\/[^/"?#]+\/assets\/[^/"?#]+)(?:\?size=([a-z0-9]+))?"/g;
const LOCAL = 'https://local';

export type AssetGrant = { apiBase: string; grant: string };

let granted: AssetGrant | null = null;

export function useAssetGrant(grant: AssetGrant | null): void {
  granted = grant;
}

function isAssetSize(value: string | null): value is AssetSize {
  return Object.values(AssetSize).includes(value as AssetSize);
}

export function isCanvasAssetPath(pathname: string): boolean {
  return ASSET_PATH.test(pathname);
}

export function isGrantable(pathname: string): boolean {
  return GRANTABLE.some((route) => route.test(pathname));
}

export function grantedPath(path: string): string {
  if (!granted) {
    return path;
  }
  const url = new URL(path, LOCAL);
  url.searchParams.set(ASSET_GRANT_PARAM, granted.grant);
  return `${granted.apiBase}${url.pathname}${url.search}`;
}

function withSize(path: string, size: AssetSize): string {
  return grantedPath(size === AssetSize.Full ? path : `${path}?${SIZE_PARAM}=${size}`);
}

export function canvasAssetUrl(projectId: string, canvasId: string, assetId: string, size: AssetSize): string {
  return withSize(`/p/${projectId}/c/${canvasId}/assets/${assetId}`, size);
}

function assetPathOf(url: string): string | null {
  const parsed = new URL(url, LOCAL);
  const ours = parsed.origin === LOCAL || parsed.origin === granted?.apiBase;
  return ours && isCanvasAssetPath(parsed.pathname) ? parsed.pathname : null;
}

export function sized(url: string, size: AssetSize): string {
  const path = assetPathOf(url);
  return path ? withSize(path, size) : url;
}

export function grantedAssetPaths(text: string): string {
  return text.replace(ASSET_PATH_IN_TEXT, (_, path: string, size: string | undefined) => `"${withSize(path, isAssetSize(size ?? null) ? (size as AssetSize) : AssetSize.Full)}"`);
}

export function sizeOf(url: URL): AssetSize {
  const size = url.searchParams.get(SIZE_PARAM);
  return isAssetSize(size) ? size : AssetSize.Full;
}
