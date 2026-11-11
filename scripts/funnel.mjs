import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DAYS = Number(process.argv.find((arg) => arg.startsWith('--days='))?.split('=')[1] ?? 14);
const MS_PER_DAY = 86_400_000;

const STEPS = [
  'landing_prompt_sent',
  'login_started',
  'signup_completed',
  'handoff_resumed',
  'canvas_created',
  'agent_started',
  'agent_first_output',
  'agent_failed',
  'credits_exhausted',
  'import_failed'
];

function readEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !(m[1] in env)) {
        env[m[1]] = m[2];
      }
    }
  } catch {
    return env;
  }
  return env;
}

const env = readEnv();
const url = env.PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const since = new Date(Date.now() - DAYS * MS_PER_DAY).toISOString().slice(0, 10);
const res = await fetch(`${url}/rest/v1/product_funnel_daily?select=day,event,people&day=gte.${since}&order=day.asc`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
if (!res.ok) {
  console.error(`funnel read failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const byDay = new Map();
for (const row of await res.json()) {
  const day = byDay.get(row.day) ?? {};
  day[row.event] = row.people;
  byDay.set(row.day, day);
}

console.log(['day', ...STEPS].join('\t'));
for (const [day, counts] of byDay) {
  console.log([day, ...STEPS.map((step) => counts[step] ?? 0)].join('\t'));
}
