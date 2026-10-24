import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENV_FILE = `${ROOT}.env`;
const ENV_TEMPLATE = `${ROOT}.env.example`;
const APP_SECRET_BYTES = 32;
const DEFAULT_APP_URL = 'http://localhost:5173';
const SUPABASE_STATUS_TO_ENV = {
  API_URL: 'PUBLIC_SUPABASE_URL',
  ANON_KEY: 'PUBLIC_SUPABASE_ANON_KEY',
  SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  DB_URL: 'DATABASE_URL'
};
const REQUIRED_KEYS = ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'APP_SECRET', 'PUBLIC_APP_URL'];

export function parseEnv(text) {
  const values = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) {
      values[match[1]] = match[2].replace(/^"|"$/g, '');
    }
  }
  return values;
}

export function upsertEnv(text, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(text)) {
    return text.replace(pattern, () => line);
  }
  return `${text.replace(/\n*$/, '\n')}${line}\n`;
}

export function missingKeys(values) {
  return REQUIRED_KEYS.filter((key) => !values[key]);
}

function supabaseStatus() {
  try {
    const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return parseEnv(out);
  } catch {
    return {};
  }
}

function run(script) {
  execFileSync('node', ['--env-file=.env', script], { cwd: ROOT, stdio: 'inherit' });
}

function main() {
  if (!existsSync(ENV_FILE)) {
    copyFileSync(ENV_TEMPLATE, ENV_FILE);
    console.log('created .env from .env.example');
  }

  let text = readFileSync(ENV_FILE, 'utf8');
  const current = parseEnv(text);
  const status = current.PUBLIC_SUPABASE_URL ? {} : supabaseStatus();

  for (const [statusKey, envKey] of Object.entries(SUPABASE_STATUS_TO_ENV)) {
    if (!current[envKey] && status[statusKey]) {
      text = upsertEnv(text, envKey, status[statusKey]);
    }
  }
  if (!current.APP_SECRET) {
    text = upsertEnv(text, 'APP_SECRET', randomBytes(APP_SECRET_BYTES).toString('hex'));
  }
  if (!current.PUBLIC_APP_URL) {
    text = upsertEnv(text, 'PUBLIC_APP_URL', DEFAULT_APP_URL);
  }
  if (!current.BILLING_PROVIDER) {
    text = upsertEnv(text, 'BILLING_PROVIDER', 'open');
  }
  writeFileSync(ENV_FILE, text);

  const missing = missingKeys(parseEnv(text));
  if (missing.length > 0) {
    console.error(`\nStill missing in .env: ${missing.join(', ')}\nStart Supabase first (supabase start) or fill them by hand, then re-run npm run setup.`);
    process.exit(1);
  }

  run('scripts/db-migrate.mjs');
  run('scripts/db-seed.mjs');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
