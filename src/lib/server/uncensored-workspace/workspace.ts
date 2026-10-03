import type { Db } from '$lib/server/db/client';
import { UncensoredLock } from '$lib/uncensored-lock';
import { ageStore, configuredVerifier, uncensoredLockFor } from './workspace-server';
import { verifyAge } from './age-verification';

export type VerifyOutcome = { ok: true } | { ok: false; error: string } | { ok: false; redirect: string };

export async function verifyUserAge(db: Db, input: { orgId: string; userId: string; returnUrl: string }): Promise<VerifyOutcome> {
  const verifier = configuredVerifier();
  const lock = await uncensoredLockFor(db, input);
  if (lock === UncensoredLock.Open) {
    return { ok: true };
  }
  if (!verifier || lock !== UncensoredLock.AgeUnverified) {
    return { ok: false, error: lock };
  }
  return verifyAge(verifier, ageStore(db), input.userId, input.returnUrl);
}
