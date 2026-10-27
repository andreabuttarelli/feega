import { readFileSync, writeFileSync } from 'node:fs';

const OUT = process.env.PERF_OUT ?? new URL('./out/', import.meta.url).pathname;
const data = JSON.parse(readFileSync(`${OUT}/results.json`, 'utf8'));

type Sweep = { fpsMedian: number; fpsP5: number; p95Ms: number; maxMs: number; over33: number };
type Summary = Record<string, number> & { panFit: Sweep; zoom: Sweep; panZoomed: Sweep };

const configs = Object.keys(data.results);
const header = ['metric', ...configs];
const row = (label: string, pick: (s: Summary) => string | number) => [label, ...configs.map((c) => String(pick(data.results[c].summary)))];
const table = (rows: string[][]) => [header, header.map(() => '---'), ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n');

const rows = [
  row('DOM nodes present (ms)', (s) => s.firstNodeMs),
  row('first painted node (ms)', (s) => s.firstPaintMs),
  row('FCP (ms)', (s) => s.fcpMs),
  row('no blank nodes (ms)', (s) => s.fullPaintMs),
  row('blank nodes at first paint', (s) => s.blankAtFirstNode),
  row('blank nodes once settled', (s) => s.settledFlat),
  row('JS heap after load (MB)', (s) => s.heapLoadMb),
  row('JS heap peak (MB)', (s) => s.heapPeakMb),
  row('long tasks (count)', (s) => s.longTasks),
  row('long tasks (total ms)', (s) => s.longTaskMs),
  ...(['panFit', 'zoom', 'panZoomed'] as const).flatMap((k) => [
    row(`${k} fps median`, (s) => s[k].fpsMedian),
    row(`${k} fps p5`, (s) => s[k].fpsP5),
    row(`${k} frame p95 (ms)`, (s) => s[k].p95Ms),
    row(`${k} worst frame (ms)`, (s) => s[k].maxMs),
    row(`${k} frames >33 ms`, (s) => s[k].over33)
  ])
];

const flashes = configs.map((c) => `${c}: ${data.results[c].runs.map((r: { flashes: number }) => r.flashes).join('/')}`).join('; ');
const profiles = configs
  .map((c) => `**${c}**\n\n| self time | % | function |\n|---|---|---|\n${data.profiles[c].map((p: { fn: string; ms: number; pct: number }) => `| ${p.ms} ms | ${p.pct} | \`${p.fn.replace(/\|/g, '\\|')}\` |`).join('\n')}`)
  .join('\n\n');

const md = `# Big-canvas performance (${data.at})\n\nMedian of ${data.results[configs[0]].runs.length} runs per column. \`default\` = the shipped renderer, \`webgpu\` = \`?renderer=webgpu\`; \`x1\` = no throttle, \`x4\` = CPU throttle 4x.\n\n${table(rows)}\n\nFlashes (painted node turning blank again during load), per run: ${flashes}\n\n## CPU profile, self time during the three sweeps (one profiled run per column)\n\n${profiles}\n`;
writeFileSync(`${OUT}/results.md`, md);
console.log(md);
