export const SETTINGS_COLUMN = { w: 320, h: 360 } as const;

export enum ColumnAxis {
  Beside = 'beside',
  Below = 'below'
}

export type Growth = { w: number; h: number };

const NO_GROWTH: Growth = { w: 0, h: 0 };

const GROWTH_OF: Record<ColumnAxis, Growth> = {
  [ColumnAxis.Beside]: { w: SETTINGS_COLUMN.w, h: 0 },
  [ColumnAxis.Below]: { w: 0, h: SETTINGS_COLUMN.h }
};

type Base = { w: number; h: number; settings?: boolean };

type Sized = { id: string; selected?: boolean; width?: number; height?: number; data: Record<string, unknown> };

export function growthOf(data: Record<string, unknown>): Growth {
  return (data.growth as Growth | undefined) ?? NO_GROWTH;
}

export function withSettingsColumn<N extends Sized>(nodes: N[], bases: Map<string, Base>, axis: ColumnAxis): N[] | null {
  let changed = false;

  const next = nodes.map((n) => {
    const base = bases.get(n.id);
    if (!base?.settings) {
      return n;
    }

    const growth = n.selected ? GROWTH_OF[axis] : NO_GROWTH;
    const width = base.w + growth.w;
    const height = base.h + growth.h;
    const current = growthOf(n.data);
    if (n.width === width && n.height === height && current.w === growth.w && current.h === growth.h) {
      return n;
    }

    changed = true;
    return { ...n, width, height, data: { ...n.data, growth } };
  });

  return changed ? next : null;
}
