import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
const MS_PER_DAY = 86_400_000;
const PAGE_ROWS = 1000;
const USERS_PAGE = 1000;
const GESTURES = ['pan', 'zoom', 'fit', 'drag'];

export const INTERNAL = { emails: ['test@dazero.co'], domains: ['feega.app', 'dazero.co'], teamOrgIdsEnv: 'PERF_TEAM_ORG_IDS' };

export const SizeBucket = { Small: '1-10', Medium: '11-50', Large: '51-200', Huge: '200+' };

const SIZE_CEILINGS = [
  [10, SizeBucket.Small],
  [50, SizeBucket.Medium],
  [200, SizeBucket.Large]
];

export const sizeBucket = (frames) => SIZE_CEILINGS.find(([ceiling]) => frames <= ceiling)?.[1] ?? SizeBucket.Huge;

const quantile = (values, q) => {
  const sorted = values.filter((v) => typeof v === 'number').sort((a, b) => a - b);
  if (!sorted.length) {
    return null;
  }
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
};

function overShare(sessions, kind) {
  let frames = 0;
  let over = 0;
  for (const s of sessions) {
    const g = s.gestures?.[kind];
    if (!g?.frames) {
      continue;
    }
    frames += g.frames;
    over += g.frames * (g.over ?? 0);
  }
  return frames ? over / frames : null;
}

function latestPerSession(rows) {
  const latest = new Map();
  rows.forEach((row, i) => {
    const key = row.props?.sessionId ?? `row-${i}`;
    const kept = latest.get(key);
    if (!kept || (row.props?.sessionMs ?? 0) > (kept.props?.sessionMs ?? 0)) {
      latest.set(key, row);
    }
  });
  return [...latest.values()];
}

export function report(rows, internalUsers) {
  const groups = new Map();
  for (const row of latestPerSession(rows)) {
    if (internalUsers.has(row.user_id)) {
      continue;
    }
    const p = row.props ?? {};
    const key = `${p.device ?? '?'}|${sizeBucket(p.frames ?? 0)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  return [...groups].map(([key, sessions]) => {
    const [device, size] = key.split('|');
    return {
      device,
      size,
      sessions: sessions.length,
      firstContentP50: quantile(sessions.map((s) => s.load?.firstContent), 0.5),
      sharpP50: quantile(sessions.map((s) => s.load?.sharp), 0.5),
      sharpP95: quantile(sessions.map((s) => s.load?.sharp), 0.95),
      over: Object.fromEntries(GESTURES.map((kind) => [kind, overShare(sessions, kind)])),
      editP50: quantile(sessions.map((s) => s.edit?.p50), 0.5),
      editP95: quantile(sessions.map((s) => s.edit?.p95), 0.95),
      webglFallback: sessions.filter((s) => s.backend === 'webgl' && s.fallbacks > 0).length / sessions.length
    };
  });
}

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

const isInternal = (email) => {
  const e = (email ?? '').toLowerCase();
  return INTERNAL.emails.includes(e) || INTERNAL.domains.some((d) => e.endsWith(`@${d}`));
};

async function get(url, key, path) {
  const res = await fetch(`${url}${path}`, { headers: { apikey: key, authorization: `Bearer ${key}` } });
  if (!res.ok) {
    throw new Error(`${path}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function internalUsers(url, key, teamOrgIds) {
  const ids = new Set();
  for (let page = 1; ; page++) {
    const { users } = await get(url, key, `/auth/v1/admin/users?page=${page}&per_page=${USERS_PAGE}`);
    users.filter((u) => isInternal(u.email)).forEach((u) => ids.add(u.id));
    if (users.length < USERS_PAGE) {
      break;
    }
  }
  if (teamOrgIds.length) {
    const members = await get(url, key, `/rest/v1/orgs_members?select=user_id&org_id=in.(${teamOrgIds.join(',')})`);
    members.forEach((m) => ids.add(m.user_id));
  }
  return ids;
}

async function events(url, key, since) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_ROWS) {
    const page = await get(url, key, `/rest/v1/product_events?select=user_id,props&event=eq.canvas_perf&created_at=gte.${since}&order=created_at.asc&limit=${PAGE_ROWS}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE_ROWS) {
      return rows;
    }
  }
}

const pct = (v) => (v === null ? '-' : `${(v * 100).toFixed(1)}%`);
const ms = (v) => (v === null ? '-' : String(Math.round(v)));

async function main() {
  const days = Number(process.argv.find((arg) => arg.startsWith('--days='))?.split('=')[1] ?? 7);
  const env = readEnv();
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }

  const since = new Date(Date.now() - days * MS_PER_DAY).toISOString();
  const teamOrgIds = (env[INTERNAL.teamOrgIdsEnv] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const [rows, internal] = await Promise.all([events(url, key, since), internalUsers(url, key, teamOrgIds)]);

  console.log(['device', 'size', 'sessions', 'first p50', 'sharp p50', 'sharp p95', ...GESTURES.map((g) => `${g} >11.1ms`), 'edit p50', 'edit p95', 'webgl fallback'].join('\t'));
  for (const r of report(rows, internal).sort((a, b) => a.device.localeCompare(b.device) || a.size.localeCompare(b.size))) {
    console.log([r.device, r.size, r.sessions, ms(r.firstContentP50), ms(r.sharpP50), ms(r.sharpP95), ...GESTURES.map((g) => pct(r.over[g])), ms(r.editP50), ms(r.editP95), pct(r.webglFallback)].join('\t'));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
