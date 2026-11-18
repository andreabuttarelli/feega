import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERF_DIR, flags, sleep } from './machine.mjs';
import { summarise } from './summarise.mjs';

const YIELD_MS = 45_000;
const TOOLS = { load: 'load.mjs', gesture: 'gesture.mjs' };

const opts = flags();
if (!TOOLS[opts.tool] || !opts.a) {
  console.log('usage: node scripts/perf/kit/ab.mjs --tool=load|gesture --a=<repo root> [--b=<repo root>] [--runs=5] [--fixture=…] [--only=…] [--out=<file.jsonl>]');
  process.exit(1);
}

const builds = [['A', opts.a], ...(opts.b ? [['B', opts.b]] : [])];
const out = opts.out ?? join(PERF_DIR, 'results', `${new Date().toISOString().replace(/[:.]/g, '-')}-${opts.tool}.jsonl`);
mkdirSync(join(out, '..'), { recursive: true });
const pass = ['fixture', 'only'].filter((k) => opts[k]).map((k) => `--${k}=${opts[k]}`);

for (let i = 0; i < Number(opts.runs ?? 5); i++) {
  const order = i % 2 ? [...builds].reverse() : builds;
  for (const [name, root] of order) {
    if (i || name !== order[0][0]) {
      await sleep(YIELD_MS);
    }
    console.error(`ab: run ${i + 1} ${name} ${root}`);
    spawnSync(process.execPath, [fileURLToPath(new URL(TOOLS[opts.tool], import.meta.url)), `--build=${root}`, `--name=${name}`, `--out=${out}`, ...pass], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
}

console.log(`results: ${out}`);
console.log(summarise(out));
