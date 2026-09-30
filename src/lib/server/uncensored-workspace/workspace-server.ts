import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { uncensoredAccess } from '$lib/server/uncensored-access';
import { modelRefusal, modeOf, ProjectMode } from '$lib/project-mode';
import { uncensoredLock, UncensoredLock, type UncensoredFacts } from '$lib/uncensored-lock';
import { VerifierSetting, verifierFor, type AgeVerificationStore, type AgeVerifier } from './age-verification';

const UNCENSORED_FLAG = 'uncensored_mode';
const VERIFICATION_WRITE_USE = 'src/lib/server/uncensored-workspace/age-verification.ts — recordAgeVerification';

function untyped(db: Db): SupabaseClient {
  return db as unknown as SupabaseClient;
}

function devManualOn(): boolean {
  return dev && env.UNCENSORED_DEV_MANUAL_VERIFICATION === 'true';
}

export function configuredVerifier(): AgeVerifier | null {
  return verifierFor(devManualOn() ? VerifierSetting.DevManual : VerifierSetting.None);
}

async function flagOn(db: Db): Promise<boolean> {
  if (devManualOn()) {
    return true;
  }
  const { data } = await untyped(db).from('feature_flags').select('enabled').eq('key', UNCENSORED_FLAG).maybeSingle();
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

export async function uncensoredFacts(db: Db, input: { orgId: string; userId: string }): Promise<UncensoredFacts> {
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

export async function uncensoredLockFor(db: Db, input: { orgId: string; userId: string }): Promise<UncensoredLock> {
  return uncensoredLock(await uncensoredFacts(db, input));
}

export async function projectModeOf(db: Db, input: { orgId: string; projectId: string }): Promise<ProjectMode> {
  const { data } = await untyped(db).from('projects').select('mode').eq('id', input.projectId).eq('org_id', input.orgId).maybeSingle();
  return modeOf((data as { mode?: string } | null)?.mode);
}

export async function canvasModeOf(db: Db, input: { orgId: string; canvasId: string }): Promise<ProjectMode> {
  const { data } = await untyped(db).from('canvases').select('projects(mode)').eq('id', input.canvasId).eq('org_id', input.orgId).maybeSingle();
  return modeOf((data as { projects?: { mode?: string } | null } | null)?.projects?.mode);
}

export async function uncensoredProjectIds(db: Db, orgId: string): Promise<Set<string>> {
  const { data } = await untyped(db).from('projects').select('id').eq('org_id', orgId).eq('mode', ProjectMode.Uncensored);
  return new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
}

export const UNCENSORED_LOCKED = 'uncensored_workspace_locked';

export async function generationRefusal(
  db: Db,
  input: { orgId: string; projectId: string; userId: string; model: string | null }
): Promise<string | null> {
  const mode = await projectModeOf(db, input);
  const refused = modelRefusal(mode, input.model);
  if (refused) {
    return refused;
  }
  if (mode !== ProjectMode.Uncensored) {
    return null;
  }
  return (await uncensoredLockFor(db, input)) === UncensoredLock.Open ? null : UNCENSORED_LOCKED;
}

export async function canvasReachable(db: Db, found: { orgId: string; mode: ProjectMode }, userId: string): Promise<boolean> {
  if (found.mode !== ProjectMode.Uncensored) {
    return true;
  }
  return (await uncensoredLockFor(db, { orgId: found.orgId, userId })) === UncensoredLock.Open;
}
