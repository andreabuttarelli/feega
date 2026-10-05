export const BENTO_LAYOUT = 'bento';

export enum CellTiming {
  Loop = 'loop',
  Hold = 'hold'
}

export enum CellFit {
  Cover = 'cover',
  Contain = 'contain'
}

export const CELL_TIMINGS = Object.values(CellTiming) as [CellTiming, ...CellTiming[]];
export const CELL_FITS = Object.values(CellFit) as [CellFit, ...CellFit[]];

export type BentoCard = {
  assetId: string;
  kind: 'image' | 'video' | 'comp';
  fit?: CellFit;
  focusX?: number;
  focusY?: number;
  background?: string;
  columns?: number;
  rows?: number;
  timing?: CellTiming;
};

export function bentoCellId(gridId: string, item: number): string {
  return `${gridId}__b${item}`;
}

export function heldCell(card: Pick<BentoCard, 'timing'>): boolean {
  return card.timing === CellTiming.Hold;
}
