import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BRIEFS, PLAIN_SUFFIX, briefText, makeFixtures } from './briefs';
import { PLAIN_MODEL, PLAIN_RESULT, PLAIN_VIDEO, type PlainResult } from './plain-result';

const CAP_USD = 5;
const KILL_MS = 30 * 60_000;

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const out = arg('out');
const only = arg('only');

function runClaude(cwd: string, prompt: string): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  const args = ['-p', '--output-format', 'json', '--model', PLAIN_MODEL, '--max-budget-usd', String(CAP_USD), '--strict-mcp-config', '--setting-sources', 'project', '--no-session-persistence', '--dangerously-skip-permissions'];
  return new Promise((done) => {
    const child = spawn('claude', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, KILL_MS);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, stdout, stderr, timedOut });
    });
    child.stdin.end(prompt);
  });
}

async function main() {
  if (!out) {
    throw new Error('pass --out=<dir>: the versus runner reads Arm A from there');
  }
  const root = resolve(out);
  const fixtures = join(root, 'fixtures');
  await makeFixtures(fixtures);
  for (const brief of BRIEFS.filter((b) => !only || only.split(',').includes(b.name))) {
    const dir = join(root, brief.name);
    mkdirSync(dir, { recursive: true });
    const work = mkdtempSync(join(tmpdir(), `versus-${brief.name}-`));
    for (const f of brief.files) {
      copyFileSync(join(fixtures, f), join(work, f));
    }
    console.log(`${brief.name}: claude in ${work}`);
    const t0 = Date.now();
    const r = await runClaude(work, `${briefText(brief)}\n\n${PLAIN_SUFFIX}`);
    const made = join(work, PLAIN_VIDEO);
    if (existsSync(made)) {
      copyFileSync(made, join(dir, PLAIN_VIDEO));
    }
    const result: PlainResult = { work, exitCode: r.code, timedOut: r.timedOut, wallS: (Date.now() - t0) / 1000, video: existsSync(made), raw: r.stdout, stderr: r.stderr.slice(-4000) };
    writeFileSync(join(dir, PLAIN_RESULT), JSON.stringify(result, null, 1));
    console.log(`  ${result.video ? 'out.mp4' : 'NO VIDEO'} in ${result.wallS.toFixed(0)} s`);
  }
}

await main();
