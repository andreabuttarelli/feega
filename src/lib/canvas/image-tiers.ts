import { AssetSize, TIER_PX, TIERS, type Tier } from './asset-url';

export type TileView = { id: string; cssWidth: number; visible: boolean; current: Tier | null };
export type TierContext = { zoom: number; dpr: number; budgetPx: number };

const SMALLEST = TIERS[0];
const DOWNGRADE_STEPS = 2;

export function tierFor(cssWidth: number, zoom: number, dpr: number): Tier {
  const needed = cssWidth * zoom * dpr;
  return TIERS.find((tier) => TIER_PX[tier] >= needed) ?? AssetSize.Full;
}

export function nextTier(current: Tier | null, needed: Tier): Tier {
  if (!current) {
    return needed;
  }

  const drop = TIERS.indexOf(current) - TIERS.indexOf(needed);
  return drop > 0 && drop < DOWNGRADE_STEPS ? current : needed;
}

export function decodedPx(tier: Tier): number {
  return TIER_PX[tier] * TIER_PX[tier];
}

function stepDown(tier: Tier): Tier {
  return TIERS[Math.max(0, TIERS.indexOf(tier) - 1)];
}

function totalPx(tiers: Map<string, Tier>): number {
  return [...tiers.values()].reduce((sum, tier) => sum + decodedPx(tier), 0);
}

function atFloor(tiers: Map<string, Tier>): boolean {
  return [...tiers.values()].every((tier) => tier === SMALLEST);
}

function fitBudget(tiers: Map<string, Tier>, budgetPx: number): Map<string, Tier> {
  while (totalPx(tiers) > budgetPx && !atFloor(tiers)) {
    for (const [id, tier] of tiers) {
      tiers.set(id, stepDown(tier));
    }
  }
  return tiers;
}

export function planTiers(tiles: TileView[], context: TierContext): Map<string, Tier> {
  const { zoom, dpr, budgetPx } = context;
  const shown = tiles.filter((tile) => tile.visible);
  const sharp = new Map(shown.map((tile) => [tile.id, nextTier(tile.current, tierFor(tile.cssWidth, zoom, dpr))]));

  return new Map([...tiles.map((tile) => [tile.id, SMALLEST] as const), ...fitBudget(sharp, budgetPx)]);
}
