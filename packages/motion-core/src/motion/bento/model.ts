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

export type CompFrame = { width: number; height: number };
type FramedDoc = { comps: Record<string, { frame?: CompFrame }>; tracks: readonly { clips: readonly { id: string; component: string; props: Record<string, unknown> }[] }[] };

export function cellFrames(doc: FramedDoc): { prefix: string; frame: CompFrame }[] {
  return doc.tracks
    .flatMap((t) => t.clips)
    .filter((c) => c.component === 'Composition' && c.props.layout === BENTO_LAYOUT)
    .flatMap((grid) =>
      ((grid.props.media ?? []) as BentoCard[]).flatMap((card, item) => {
        const frame = card.kind === 'comp' ? doc.comps[card.assetId]?.frame : undefined;
        return frame ? [{ prefix: `${bentoCellId(grid.id, item)}__`, frame }] : [];
      })
    );
}

export function heldCell(card: Pick<BentoCard, 'timing'>): boolean {
  return card.timing === CellTiming.Hold;
}
