import { MAX_PERCENT } from './size-entry';
import type { LayoutItem } from './model';

export enum LimitUnit {
  Px = 'px',
  Percent = 'percent'
}

export enum Bound {
  Min = 'min',
  Max = 'max'
}

export type LimitAxis = 'width' | 'height';

export type Limit = { unit: LimitUnit; value: number };

type LimitKey = 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight' | 'minWidthPercent' | 'maxWidthPercent' | 'minHeightPercent' | 'maxHeightPercent';

const KEYS: Record<LimitAxis, Record<Bound, Record<LimitUnit, LimitKey>>> = {
  width: { [Bound.Min]: { [LimitUnit.Px]: 'minWidth', [LimitUnit.Percent]: 'minWidthPercent' }, [Bound.Max]: { [LimitUnit.Px]: 'maxWidth', [LimitUnit.Percent]: 'maxWidthPercent' } },
  height: { [Bound.Min]: { [LimitUnit.Px]: 'minHeight', [LimitUnit.Percent]: 'minHeightPercent' }, [Bound.Max]: { [LimitUnit.Px]: 'maxHeight', [LimitUnit.Percent]: 'maxHeightPercent' } }
};

const UNITS: readonly LimitUnit[] = [LimitUnit.Percent, LimitUnit.Px];

export const LIMIT_AXES: readonly LimitAxis[] = ['width', 'height'];
export const BOUNDS = Object.values(Bound);

const LIMIT_TEXT = /^(\d+(?:\.\d+)?)\s*(px|%)?$/i;

const SUFFIX: Record<LimitUnit, string> = { [LimitUnit.Px]: 'px', [LimitUnit.Percent]: '%' };

export function parseLimit(text: string): Limit | null {
  const match = LIMIT_TEXT.exec(text.trim());
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (match[2] !== '%') {
    return { unit: LimitUnit.Px, value };
  }
  return value > 0 && value <= MAX_PERCENT ? { unit: LimitUnit.Percent, value } : null;
}

export const formatLimit = (limit: Limit): string => `${limit.value}${SUFFIX[limit.unit]}`;

export function limitOf(item: LayoutItem, axis: LimitAxis, bound: Bound): Limit | null {
  const unit = UNITS.find((u) => item[KEYS[axis][bound][u]] !== undefined);
  return unit ? { unit, value: item[KEYS[axis][bound][unit]] as number } : null;
}

export const limitPatch = (axis: LimitAxis, bound: Bound, limit: Limit | null): Partial<LayoutItem> =>
  Object.fromEntries(UNITS.map((u) => [KEYS[axis][bound][u], limit?.unit === u ? limit.value : undefined]));
