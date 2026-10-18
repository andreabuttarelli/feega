import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const OUT = join(homedir(), 'Documents/feega-videos/gpu-motion');
const [display = '960', dpr = '2', frames = '12', ...docs] = process.argv.slice(2);
const rows = [];
for (const doc of docs) {
  for (const engine of ['chromium', 'webkit']) {
    const name = `${doc.split('/').pop().replace(/\.(doc\.)?json$/, '')}-${engine}-${display}x${dpr}`;
    let verdict = '';
    try {
      execFileSync('npm', ['run', '-s', 'bench:gpu-parity', '--', `--doc=${doc}`, `--frames=${frames}`, `--display=${display}`, `--dpr=${dpr}`, `--engine=${engine}`, `--name=${name}`, ...(process.env.REF ? [`--ref=${process.env.REF}`] : [])], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 1_800_000 });
    } catch (e) {
      const all = `${e.stdout ?? ''}${e.stderr ?? ''}`;
      verdict = all.match(/GpuIneligible[^\n]*/)?.[0]?.slice(0, 80) ?? `error ${all.match(/Error[^\n]*/)?.[0] ?? ''}`;
    }
    const report = join(OUT, name, 'parity.md');
    const mean = !verdict && existsSync(report) ? readFileSync(report, 'utf8').match(/mean SSIM ([\d.]+), worst ([\d.]+)/) : null;
    rows.push(`| ${name} | ${mean ? mean[1] : '-'} | ${mean ? mean[2] : '-'} | ${verdict ? 'refused/failed: ' + verdict.slice(0, 120) : 'gpu'} |`);
    console.log(rows[rows.length - 1]);
  }
}
console.log(['| doc | mean SSIM | worst | engine |', '|---|---|---|---|', ...rows].join('\n'));
