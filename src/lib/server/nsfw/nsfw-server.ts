import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { uncensoredAccess } from '$lib/server/uncensored-access';
import { modelRefusal, modeOf, ProjectMode } from '$lib/project-mode';
import { nsfwLock, NsfwLock, type NsfwFacts } from '$lib/nsfw-access';
import { VerifierSetting, verifierFor, type AgeVerificationStore, type AgeVerifier } from './age-verification';

const NSFW_FLAG = 'nsfw_mode';
const VERIFICATION_WRITE_USE = 'src/lib/server/nsfw/age-verification.ts — recordAgeVerification';

function untyped(db: Db): SupabaseClient {
  return db as unknown as SupabaseClient;
}

function devManualOn(): boolean {
  return dev && env.NSFW_DEV_MANUAL_VERIFICATION === 'true';
}

export function configuredVerifier(): AgeVerifier | null {
  return verifierFor(devManualOn() ? VerifierSetting.DevManual : VerifierSetting.None);
}

async function flagOn(db: Db): Promise<boolean> {
  if (devManualOn()) {
    return true;
  }
  const { data } = await untyped(db).from('feature_flags').select('enabled').eq('key', NSFW_FLAG).maybeSingle();
  return (data as { enabled?: boolean } | null)?.enabled === true;
}

function writerDb(): Db {
  const use = SERVICE_ROLE_USES.find((u) => u.path.startsWith(VERIFICATION_WRITE_USE));
  if (!use) {
    throw new Error(`uso della service role non dichiarato nel registro: ${VERIFICATION_WRITE_USE}`);
  }
  return createServiceRoleDb(use);
}

export function ageStore(db: Db): AgeVerificationStore {
  return {
    async save(row) {
      const { error } = await untyped(writerDb())
        .from('user_age_verifications')
        .insert({ user_id: row.userId, provider: row.provider, method: row.method, result: 'adult' });
      if (error) {
        throw error;
      }
    },
    async isVerified(userId) {
      const { data } = await untyped(db).from('user_age_verifications').select('id').eq('user_id', userId).limit(1);
      return (data ?? []).length > 0;
    }
  };
}

export async function nsfwFacts(db: Db, input: { orgId: string; userId: string }): Promise<NsfwFacts> {
  const [flag, access, verified] = await Promise.all([
    flagOn(db),
    uncensoredAccess(db, input.orgId),
    ageStore(db).isVerified(input.userId)
  ]);
  return {
    flagOn: flag,
    verifierReady: configuredVerifier() !== null,
    planEntitled: access.entitled,
    orgOptedIn: access.optIn !== null,
    userVerified: verified
  };
}

export async function nsfwLockFor(db: Db, input: { orgId: string; userId: string }): Promise<NsfwLock> {
  return nsfwLock(await nsfwFacts(db, input));
}

export async function projectModeOf(db: Db, input: { orgId: string; projectId: string }): Promise<ProjectMode> {
  const { data } = await untyped(db).from('projects').select('mode').eq('id', input.projectId).eq('org_id', input.orgId).maybeSingle();
  return modeOf((data as { mode?: string } | null)?.mode);
}

export async function canvasModeOf(db: Db, input: { orgId: string; canvasId: string }): Promise<ProjectMode> {
  const { data } = await untyped(db).from('canvases').select('projects(mode)').eq('id', input.canvasId).eq('org_id', input.orgId).maybeSingle();
  return modeOf((data as { projects?: { mode?: string } | null } | null)?.projects?.mode);
}

export async function nsfwProjectIds(db: Db, orgId: string): Promise<Set<string>> {
  const { data } = await untyped(db).from('projects').select('id').eq('org_id', orgId).eq('mode', ProjectMode.Nsfw);
  return new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
}

export const NSFW_LOCKED = 'nsfw_workspace_locked';

export async function generationRefusal(
  db: Db,
  input: { orgId: string; projectId: string; userId: string; model: string | null }
): Promise<string | null> {
  const mode = await projectModeOf(db, input);
  const refused = modelRefusal(mode, input.model);
  if (refused) {
    return refused;
  }
  if (mode !== ProjectMode.Nsfw) {
    return null;
  }
  return (await nsfwLockFor(db, input)) === NsfwLock.Open ? null : NSFW_LOCKED;
}
