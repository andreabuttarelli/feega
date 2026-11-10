import { AssetSize } from '$lib/canvas/asset-url';

const NEAR_ZOOM = 0.75;

export const assetTier = (zoom: number): AssetSize => (zoom >= NEAR_ZOOM ? AssetSize.Px1024 : AssetSize.Px256);

const BY_SIZE: readonly AssetSize[] = Object.values(AssetSize);
const rank = (size: AssetSize) => BY_SIZE.indexOf(size);

export const keptTier = (wanted: AssetSize, loaded: AssetSize | undefined): AssetSize => (loaded !== undefined && rank(loaded) > rank(wanted) ? loaded : wanted);
