const { spawnSync } = require('node:child_process');
const { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { prune } = require('./prune.cjs');

const REPO = resolve(__dirname, '..', '..', '..');
const OUT = resolve(__dirname, '..', 'server');
const SHIPPED = ['build', 'scripts/node-server.mjs', 'scripts/local.mjs', 'src/lib/local-ai-keys.js', 'package-lock.json'];

const flag = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];

function run(cmd, args, options) {
  const done = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (done.status !== 0) {
    process.exit(done.status ?? 1);
  }
}

async function stage() {
  const arch = flag('arch') ?? process.arch;

  if (!process.argv.includes('--skip-build')) {
    run('npm', ['run', 'build:node'], { cwd: REPO, env: { ...process.env, PUBLIC_FEEGA_LOCAL: '1' } });
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  for (const path of SHIPPED) {
    cpSync(join(REPO, path), join(OUT, path), { recursive: true });
  }

  const { name, version, type, dependencies } = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
  writeFileSync(join(OUT, 'package.json'), JSON.stringify({ name, version, type, private: true, dependencies }, null, 2));

  run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', `--cpu=${arch}`, '--os=darwin'], { cwd: OUT, env: { ...process.env, npm_config_arch: arch } });

  await prune(OUT);
}

stage();
