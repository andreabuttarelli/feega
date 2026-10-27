import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasAiKey } from '../src/lib/local-ai-keys.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DOTENV = resolve(ROOT, '.env');
const HANDLER = resolve(ROOT, 'build/handler.js');
const DEFAULT_FILE = 'canvas.feega';
const DEFAULT_PORT = '5173';
const LOOPBACK = '127.0.0.1';

export function dotenv(path = DOTENV) {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}

export function localEnv(file, port, base = process.env, fromFile = dotenv()) {
  const merged = { ...fromFile, ...base };

  return {
    ...merged,
    PUBLIC_FEEGA_LOCAL_AI: hasAiKey(merged) ? '1' : '0',
    FEEGA_LOCAL_FILE: resolve(file),
    HOST: LOOPBACK,
    PORT: port,
    PUBLIC_APP_URL: `http://localhost:${port}`,
    ORIGIN: `http://localhost:${port}`,
    PUBLIC_FEEGA_LOCAL: '1',
    PUBLIC_SUPABASE_URL: 'http://supabase.invalid',
    PUBLIC_SUPABASE_ANON_KEY: 'local',
    SUPABASE_SERVICE_ROLE_KEY: 'local',
    BILLING_PROVIDER: 'open'
  };
}

function parse(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const flag = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  return { file: args[0] ?? DEFAULT_FILE, port: flag('port') ?? DEFAULT_PORT, rebuild: argv.includes('--build') };
}

function run() {
  const { file, port, rebuild } = parse(process.argv.slice(2));
  if (rebuild || !existsSync(HANDLER)) {
    console.log('feega local: building the app once (a few minutes)…');
    const built = spawnSync('npm', ['run', 'build:node'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PUBLIC_FEEGA_LOCAL: '1' } });
    if (built.status !== 0) {
      process.exit(built.status ?? 1);
    }
  }

  console.log(`feega local: ${resolve(file)} → http://localhost:${port}`);
  const server = spawn(process.execPath, [resolve(ROOT, 'scripts/node-server.mjs')], { cwd: ROOT, stdio: 'inherit', env: localEnv(file, port) });
  const stop = (signal) => server.kill(signal);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  server.on('exit', (code) => process.exit(code ?? 0));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
