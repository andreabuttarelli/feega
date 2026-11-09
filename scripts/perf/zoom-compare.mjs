import { appendFileSync, copyFileSync, readFileSync } from 'node:fs';
import { METRICS } from './bench-stats.mjs';

const BASELINE = 'tests/perf/zoom-baseline.json';
const TOLERANCE = JSON.parse(readFileSync('tests/perf/zoom-tolerance.json', 'utf8'));

const [, , result = 'perf-results/zoom-bench.json', mode] = process.argv;

if (mode === '--refresh') {
  copyFileSync(result, BASELINE);
  console.log(`baseline refreshed from ${result}`);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8')).median;
const now = JSON.parse(readFileSync(result, 'utf8')).median;

const worse = (key) => {
  const delta = METRICS[key].better === 'higher' ? base[key] - now[key] : now[key] - base[key];
  return delta / Math.max(1, base[key]);
};

const rows = Object.keys(METRICS).map((key) => {
  const share = worse(key);
  const failed = share > TOLERANCE[key];
  return { key, share, failed, line: `| ${METRICS[key].label} | ${base[key]} | ${now[key]} | ${share > 0 ? '+' : ''}${Math.round(share * 100)}% worse | ${Math.round(TOLERANCE[key] * 100)}% | ${failed ? 'FAIL' : 'ok'} |` };
});

const table = ['### Canvas zoom benchmark (median, Chromium, CPU 4x)', '', '| metric | baseline | this PR | change | tolerance | |', '|---|---|---|---|---|---|', ...rows.map((r) => r.line)].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
}
process.exit(rows.some((r) => r.failed) ? 1 : 0);
