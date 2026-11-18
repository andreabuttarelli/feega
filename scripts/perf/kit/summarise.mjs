import { readFileSync } from 'node:fs';
import { mid } from '../bench-stats.mjs';

const SKIP = new Set(['frames', 'machine', 'cameraBefore', 'cameraAfter']);

export function flatten(value, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(value)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (SKIP.has(k)) {
      continue;
    }
    if (typeof v === 'number') {
      out[key] = v;
    } else if (v && typeof v === 'object') {
      flatten(v, key, out);
    }
  }
  return out;
}

export function summarise(file) {
  const runs = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const builds = [...new Set(runs.map((r) => r.build))];
  const rows = builds.map((b) => runs.filter((r) => r.build === b).map((r) => flatten(r)));
  const keys = [...new Set(rows.flatMap((rs) => rs.flatMap(Object.keys)))].filter((k) => k !== 'at');
  const cell = (rs, k) => {
    const v = rs.map((r) => r[k]).filter((x) => typeof x === 'number');
    return v.length ? `${Math.round(mid(v) * 10) / 10} [${Math.min(...v)}–${Math.max(...v)}]${v.length < rs.length ? ` (${rs.length - v.length} missing)` : ''}` : '-';
  };
  const head = `metric | ${builds.map((b, i) => `${b} (n=${rows[i].length})`).join(' | ')}`;
  const load = `load 1-min per run | ${builds.map((b) => runs.filter((r) => r.build === b).map((r) => r.machine.load1).join(' ')).join(' | ')}`;
  return [head, ...keys.map((k) => `${k} | ${rows.map((rs) => cell(rs, k)).join(' | ')}`), load].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.argv[2]) {
    console.log('usage: node scripts/perf/kit/summarise.mjs <results.jsonl>');
    process.exit(1);
  }
  console.log(summarise(process.argv[2]));
}
