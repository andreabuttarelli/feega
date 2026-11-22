import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { isInternalEmail } from '$lib/server/internal-users';

const CAPTURE_URL = 'https://eu.i.posthog.com/capture/';
const SEND_TIMEOUT_MS = 1500;
const SEEN_CAP = 10_000;
const NON_PROD_VERCEL_ENVS = new Set(['preview', 'development']);

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

export function postHogSink(e: Env = { ...env, ...publicEnv }, build: Build = dev ? Build.Dev : Build.Release): CoreSink | null {
  if (build === Build.Dev) {
    return null;
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

export function useCoreSink(next: CoreSink | null, check: InternalCheck | null = null) {
  sink = next;
  internal = check;
}

export const ORG_GROUP = 'organization';

export type OrgTraits = { plan: string; member_count: number; created_at: string };

function activeSink(): CoreSink | null {
  if (sink === undefined) {
    sink = postHogSink();
    internal = sink ? internalUser : null;
  }
  return sink;
}

const groupOf = (orgId: string | null | undefined) => (orgId ? { $groups: { [ORG_GROUP]: orgId } } : {});

const orgDistinctId = (orgId: string) => `${ORG_GROUP}:${orgId}`;

export function orgIdentify(orgId: string, traits: Partial<OrgTraits>): void {
  activeSink()?.({ event: '$groupidentify', distinct_id: orgDistinctId(orgId), properties: { $group_type: ORG_GROUP, $group_key: orgId, $group_set: traits, ...personless } });
}

export function markSignedUp(userId: string, at: string): void {
  const send = activeSink();
  if (!send) {
    return;
  }

  const body = { event: '$set', distinct_id: userId, properties: { $set_once: { signed_up_at: at }, $geoip_disable: true, $ip: null } };
  if (!internal) {
    send(body);
    return;
  }
  void internal(userId).then((team) => !team && send(body)).catch(() => {});
}

export function captureForOrg(orgId: string, event: string, props: object): void {
  activeSink()?.({ event, distinct_id: orgDistinctId(orgId), properties: { ...props, ...groupOf(orgId), ...personless } });
}

export function capture(userId: string | null | undefined, event: string, props: object, orgId?: string | null): void {
  if (!userId) {
    return;
  }

  const send = activeSink();
  if (!send) {
    return;
  }

  const body: Omit<CoreBody, 'api_key'> = { event, distinct_id: userId, properties: { ...props, ...groupOf(orgId), ...personless } };
  if (!internal) {
    send(body);
    return;
  }

  void internal(userId).then((team) => !team && send(body)).catch(() => {});
}
