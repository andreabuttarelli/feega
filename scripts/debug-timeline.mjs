import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const LAST_LINES = 30;
const MS_PER_S = 1000;
const KIND_WIDTH = 14;
const MARK = '>> ';
const PLAIN = '   ';

function csvCells(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') {
      cell += '"';
      i++;
      continue;
    }
    if (c === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && c === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') {
        i++;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const parsedProps = (props) => {
  if (typeof props !== 'string') {
    return props ?? {};
  }
  try {
    return JSON.parse(props);
  } catch {
    return { raw: props };
  }
};

const normal = (r) => ({ session: r.session, seq: Number(r.seq), t_ms: Number(r.t_ms), kind: r.kind, props: parsedProps(r.props) });

export function rowsOf(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed).map(normal);
  }
  if (trimmed.startsWith('{')) {
    return trimmed.split('\n').filter((l) => l.trim()).map((l) => normal(JSON.parse(l)));
  }
  const [header, ...body] = csvCells(trimmed).filter((r) => r.some((c) => c !== ''));
  return body.map((cells) => normal(Object.fromEntries(header.map((name, i) => [name.trim(), cells[i]]))));
}

const shown = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value));

const propsLine = (props) =>
  Object.entries(props)
    .filter(([, v]) => v !== null && v !== '')
    .map(([k, v]) => `${k}=${shown(v)}`)
    .join(' ');

function sessionTimeline(rows) {
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const lost = last.seq - first.seq + 1 - sorted.length;
  const clean = sorted.some((r) => r.kind === 'pagehide');
  const out = [`session ${first.session}: ${sorted.length} lines, seq ${first.seq}..${last.seq}, ${lost} lost, ${((last.t_ms - first.t_ms) / MS_PER_S).toFixed(1)} s, ${clean ? 'ended on pagehide' : 'no pagehide: the tab died or is still open'}`];
  const markFrom = sorted.length - LAST_LINES;

  sorted.forEach((r, i) => {
    const before = sorted[i - 1];
    if (before && r.seq - before.seq > 1) {
      const gap = r.seq - before.seq - 1;
      out.push(`-- ${gap} line${gap === 1 ? '' : 's'} lost --`);
    }
    const at = (r.t_ms / MS_PER_S).toFixed(3).padStart(9);
    out.push(`${i >= markFrom ? MARK : PLAIN}${String(r.seq).padStart(6)} ${at}s  ${r.kind.padEnd(KIND_WIDTH)} ${propsLine(r.props)}`);
  });
  return out.join('\n');
}

export function timeline(text) {
  const bySession = new Map();
  for (const r of rowsOf(text)) {
    bySession.set(r.session, [...(bySession.get(r.session) ?? []), r]);
  }
  return [...bySession.values()].map(sessionTimeline).join('\n\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
  console.log(timeline(source));
}
