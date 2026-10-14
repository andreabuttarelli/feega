export type SelectionBox = { x: number; y: number; width: number; height: number };
export type SelectionReport = { ids: string[]; box: SelectionBox | null; zoom: number };

export enum ReportChange {
  None = 'none',
  Box = 'box',
  Ids = 'ids'
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

const sameBox = (a: SelectionBox | null, b: SelectionBox | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

export function reportChange(previous: SelectionReport, next: SelectionReport): ReportChange {
  if (!sameIds(previous.ids, next.ids)) {
    return ReportChange.Ids;
  }
  if (!next.ids.length) {
    return ReportChange.None;
  }
  return sameBox(previous.box, next.box) && previous.zoom === next.zoom ? ReportChange.None : ReportChange.Box;
}
