import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { isLocalMode } from '$lib/local-user';
import { LOCAL_MODE_EVENTS, ONCE_PER_FRAME, type CoreEvent, type CoreProps } from '$lib/core-usage';

const CAPTURE_URL = 'https://eu.i.posthog.com/capture/';
const SEND_TIMEOUT_MS = 1500;
const SEEN_CAP = 10_000;
const NON_PROD_VERCEL_ENVS = new Set(['preview', 'development']);
const TELEMETRY_OFF = '0';
const DO_NOT_TRACK = '1';

export type CoreBody = { api_key: string; event: string; distinct_id: string; properties: Record<string, unknown> };
export type CoreSink = (body: Omit<CoreBody, 'api_key'>) => void;

type Env = Record<string, string | undefined>;

export enum Build {
  Dev = 'dev',
  Release = 'release'
}

const personless = { $process_person_profile: false, $geoip_disable: true, $ip: null };

function post(body: CoreBody) {
  void fetch(CAPTURE_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(SEND_TIMEOUT_MS) }).catch(() => {});
}

const localOptedOut = (e: Env) => e.FEEGA_TELEMETRY === TELEMETRY_OFF || e.DO_NOT_TRACK === DO_NOT_TRACK;

export function postHogSink(e: Env = { ...env, ...publicEnv }, build: Build = dev ? Build.Dev : Build.Release): CoreSink | null {
  if (build === Build.Dev) {
    return null;
  }

  if (isLocalMode(e)) {
    const id = e.FEEGA_TELEMETRY_ID;
    const key = e.FEEGA_TELEMETRY_KEY;
    if (!id || !key || localOptedOut(e)) {
      return null;
    }
    return (body) => LOCAL_MODE_EVENTS.has(body.event as CoreEvent) && post({ ...body, api_key: key, distinct_id: id });
  }

  const key = e.PUBLIC_POSTHOG_KEY?.trim();
  if (!key || NON_PROD_VERCEL_ENVS.has(e.VERCEL_ENV ?? '')) {
    return null;
  }
  return (body) => post({ ...body, api_key: key });
}

let sink: CoreSink | null | undefined;
const seen = new Set<string>();

export function useCoreSink(next: CoreSink | null) {
  sink = next;
  seen.clear();
}

function firstTime(event: CoreEvent, userId: string, props: Record<string, unknown>): boolean {
  const keyOf = ONCE_PER_FRAME[event];
  if (!keyOf) {
    return true;
  }

  const key = `${event}:${userId}:${keyOf(props)}`;
  if (seen.has(key)) {
    return false;
  }

  if (seen.size >= SEEN_CAP) {
    seen.clear();
  }
  seen.add(key);
  return true;
}

export function coreEvent<E extends CoreEvent>(userId: string | null | undefined, event: E, props: CoreProps[E]): void {
  if (!userId) {
    return;
  }

  if (sink === undefined) {
    sink = postHogSink();
  }

  if (!sink || !firstTime(event, userId, props)) {
    return;
  }

  try {
    sink({ event, distinct_id: userId, properties: { ...props, ...personless } });
  } catch {}
}
