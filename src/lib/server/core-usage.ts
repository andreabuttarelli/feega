import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { isLocalMode } from '$lib/local-user';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { isInternalEmail } from '$lib/server/internal-users';
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

export type InternalCheck = (userId: string) => Promise<boolean>;

const PROFILE_USE = SERVICE_ROLE_USES.find((use) => use.path.startsWith('src/lib/server/core-usage.ts'));
const internalById = new Map<string, Promise<boolean>>();

async function profileIsInternal(userId: string): Promise<boolean> {
  if (!PROFILE_USE) {
    return true;
  }

  const { data } = await createServiceRoleDb(PROFILE_USE).from('profiles').select('email').eq('id', userId).maybeSingle();
  return isInternalEmail((data as { email?: string } | null)?.email);
}

const internalUser: InternalCheck = (userId) => {
  if (internalById.size >= SEEN_CAP) {
    internalById.clear();
  }

  const known = internalById.get(userId) ?? profileIsInternal(userId).catch(() => true);
  internalById.set(userId, known);
  return known;
};

let sink: CoreSink | null | undefined;
let internal: InternalCheck | null = null;
const seen = new Set<string>();

export function useCoreSink(next: CoreSink | null, check: InternalCheck | null = null) {
  sink = next;
  internal = check;
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
    internal = sink ? internalUser : null;
  }

  if (!sink || !firstTime(event, userId, props)) {
    return;
  }

  const send = sink;
  const body = { event, distinct_id: userId, properties: { ...props, ...personless } };
  if (!internal) {
    send(body);
    return;
  }

  void internal(userId).then((team) => !team && send(body)).catch(() => {});
}
