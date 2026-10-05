import { BENTO_LAYOUT } from './bento/model';
import { RING_LAYOUT } from './ring/model';

export const COMP_CARD = 'comp';
export const COMP_CARD_LAYOUTS: ReadonlySet<unknown> = new Set([RING_LAYOUT, BENTO_LAYOUT]);
