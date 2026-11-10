import { AssetSize } from '$lib/canvas/asset-url';
import { AHEAD_REACH } from './screen-uses';

const NEAR_ZOOM = 0.75;

export const assetTier = (zoom: number): AssetSize => (zoom >= NEAR_ZOOM ? AssetSize.Px1024 : AssetSize.Px256);

const BY_SIZE: readonly AssetSize[] = Object.values(AssetSize);
const rank = (size: AssetSize) => BY_SIZE.indexOf(size);

export enum Reach {
  Near = 'near',
  Far = 'far'
}

type Box = { x: number; y: number; w: number; h: number };
type View = { x: number; y: number; zoom: number };
type Screen = { width: number; height: number };

export function reachOf(box: Box, view: View, screen: Screen, screens = AHEAD_REACH): Reach {
  const margin = { x: (screen.width * screens) / view.zoom, y: (screen.height * screens) / view.zoom };
  const left = -view.x / view.zoom - margin.x;
  const top = -view.y / view.zoom - margin.y;
  const right = (screen.width - view.x) / view.zoom + margin.x;
  const bottom = (screen.height - view.y) / view.zoom + margin.y;
  const near = box.x + box.w >= left && box.x <= right && box.y + box.h >= top && box.y <= bottom;
  return near ? Reach.Near : Reach.Far;
}

export const keptTier = (wanted: AssetSize, loaded: AssetSize | undefined, reach: Reach): AssetSize => (reach === Reach.Near && loaded !== undefined && rank(loaded) > rank(wanted) ? loaded : wanted);
