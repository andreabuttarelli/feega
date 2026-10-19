import { AssetSize } from '$lib/canvas/asset-url';

const NEAR_ZOOM = 0.75;

export const assetTier = (zoom: number): AssetSize => (zoom >= NEAR_ZOOM ? AssetSize.Px1024 : AssetSize.Px256);
