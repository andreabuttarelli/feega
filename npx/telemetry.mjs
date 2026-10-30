import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CAPTURE_URL = 'https://eu.i.posthog.com/capture/';
const PUBLIC_KEY = 'phc_vyecfTVaAXEvHQYZoSzRzvsbPbQmafyeMGoeVJZYxvnA';
const SEND_TIMEOUT_MS = 1500;
const ID_FILE = 'telemetry-id';
const DAY_FILE = 'telemetry-day';
const OFF = '0';
const ON = '1';

export const EVENT = { started: 'npx_feega_started', activeDay: 'npx_feega_active_day' };

export const NOTICE = 'feega: anonymous usage stats (version, OS, arch, Node version, random install id) are sent on start. Disable: FEEGA_TELEMETRY=0 or DO_NOT_TRACK=1.';

export const isOptedOut = (env) => env.FEEGA_TELEMETRY === OFF || env.DO_NOT_TRACK === ON || Boolean(env.CI || env.VITEST);

const configDir = (home) => join(home, '.feega');

function readTrimmed(path) {
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : '';
}

export function installId(home) {
  const path = join(configDir(home), ID_FILE);
  const known = readTrimmed(path);
  if (known) {
    return known;
  }

  const id = randomUUID();
  mkdirSync(configDir(home), { recursive: true });
  writeFileSync(path, `${id}\n`);
  return id;
}

export function buildEvent(event, id, info) {
  return {
    api_key: PUBLIC_KEY,
    event,
    distinct_id: id,
    properties: {
      version: info.version,
      os: info.platform,
      arch: info.arch,
      node: info.node,
      $process_person_profile: false,
      $geoip_disable: true,
      $ip: null
    }
  };
}

export const postEvent = (body) =>
  fetch(CAPTURE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
  });

function firstStartOfDay(home, today) {
  const path = join(configDir(home), DAY_FILE);
  if (readTrimmed(path) === today) {
    return false;
  }

  writeFileSync(path, `${today}\n`);
  return true;
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

export async function sendTelemetry({ home, info, env, send = postEvent, notify = () => {}, today = todayUtc() }) {
  if (isOptedOut(env)) {
    return;
  }

  try {
    const firstRun = !existsSync(join(configDir(home), ID_FILE));
    const id = installId(home);
    if (firstRun) {
      notify(NOTICE);
    }

    const events = firstStartOfDay(home, today) ? [EVENT.started, EVENT.activeDay] : [EVENT.started];
    await Promise.all(events.map((event) => send(buildEvent(event, id, info))));
  } catch {}
}
