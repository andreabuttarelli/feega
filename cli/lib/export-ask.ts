export type ExportFlags = { format?: string; scale?: string; width?: string; height?: string; suffix?: string; quality?: string; transparent?: boolean; rows?: string; name?: string };

type Row = { format: string; by: string; value: number; suffix?: string; quality?: number; transparent?: boolean };

const DEFAULT_FORMAT = 'png';
const DEFAULT_SCALE = 1;

function sizeOf(flags: ExportFlags): Pick<Row, 'by' | 'value'> {
  if (flags.width) {
    return { by: 'width', value: Number(flags.width) };
  }
  if (flags.height) {
    return { by: 'height', value: Number(flags.height) };
  }
  return { by: 'scale', value: flags.scale ? Number(flags.scale) : DEFAULT_SCALE };
}

function rowOf(flags: ExportFlags): Row {
  const row: Row = { format: flags.format ?? DEFAULT_FORMAT, ...sizeOf(flags), suffix: flags.suffix ?? '' };
  if (flags.quality) {
    row.quality = Number(flags.quality);
  }
  row.transparent = Boolean(flags.transparent);
  return row;
}

const ELEMENT_SEP = ':';

export function exportAsk(targets: string[], flags: ExportFlags): { frameIds: string[]; elements: { frameId: string; elementId: string }[]; rows: Row[]; name?: string } {
  const rows = flags.rows ? (JSON.parse(flags.rows) as Row[]) : [rowOf(flags)];
  const frameIds = targets.filter((t) => !t.includes(ELEMENT_SEP));
  const elements = targets.filter((t) => t.includes(ELEMENT_SEP)).map((t) => {
    const [frameId, elementId] = t.split(ELEMENT_SEP);
    return { frameId, elementId };
  });
  return { frameIds, elements, rows, ...(flags.name ? { name: flags.name } : {}) };
}
