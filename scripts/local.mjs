import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HANDLER = resolve(ROOT, 'build/handler.js');
const DEFAULT_FILE = 'canvas.feega';
const DEFAULT_PORT = '5173';
const LOOPBACK = '127.0.0.1';

export function localEnv(file, port, base = process.env) {
  return {
    ...base,
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
