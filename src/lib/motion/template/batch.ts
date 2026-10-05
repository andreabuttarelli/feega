export type CsvTable = { headers: string[]; rows: Record<string, string>[] };
export type ColumnMap = Record<string, string | null>;

export const MAX_BATCH_ROWS = 200;
export const DEFAULT_NAME_PATTERN = '{{n}}';

const QUOTE = '"';
const TAB = '\t';
const COMMA = ',';
const ROW_DIGITS = 3;
const NAME_MAX = 80;
const SHEET = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/;
const GID = /[#&?]gid=(\d+)/;

function cells(text: string, sep: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === QUOTE && text[i + 1] === QUOTE) {
        cell += QUOTE;
        i++;
      } else if (ch === QUOTE) {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === QUOTE) {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      lines.push([...row, cell.replace(/\r$/, '')]);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  lines.push([...row, cell.replace(/\r$/, '')]);
  return lines.filter((l) => l.some((c) => c.trim() !== ''));
}

export function parseCsv(text: string): CsvTable {
  const firstLine = text.split('\n')[0] ?? '';
  const sep = firstLine.includes(TAB) && !firstLine.includes(COMMA) ? TAB : COMMA;
  const [head = [], ...body] = cells(text, sep);
  const headers = head.map((h) => h.trim());
  const rows = body.map((line) => Object.fromEntries(headers.map((h, i) => [h, line[i] ?? ''])));
  return { headers, rows };
}

export function batchRows(table: CsvTable, map: ColumnMap): Record<string, string>[] {
  const pairs = Object.entries(map).filter((e): e is [string, string] => e[1] !== null);
  return table.rows.map((row) => Object.fromEntries(pairs.map(([key, column]) => [key, row[column] ?? ''])));
}

export function outputName(pattern: string, values: Record<string, string>, row: number): string {
  const n = String(row).padStart(ROW_DIGITS, '0');
  const filled = pattern.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => (key === 'n' ? n : (values[key] ?? '')));
  const safe = filled.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, NAME_MAX);
  return safe || `row-${n}`;
}

export function sheetCsvUrl(link: string): string | null {
  const id = link.match(SHEET)?.[1];
  if (!id) {
    return null;
  }
  const gid = link.match(GID)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}
