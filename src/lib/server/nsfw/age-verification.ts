export type AgeCheck = { adult: true; method: string } | { adult: false };

export type AgeVerifier = {
  key: string;
  check(userId: string): Promise<AgeCheck>;
};

export type AgeVerificationStore = {
  save(row: { userId: string; provider: string; method: string }): Promise<void>;
  isVerified(userId: string): Promise<boolean>;
};

export enum VerifierSetting {
  None = 'none',
  DevManual = 'dev_manual'
}

export const MANUAL_ADMIN: AgeVerifier = {
  key: 'manual_admin',
  check: async () => ({ adult: true, method: 'manual_admin' })
};

const VERIFIER_OF: Readonly<Record<VerifierSetting, AgeVerifier | null>> = {
  [VerifierSetting.None]: null,
  [VerifierSetting.DevManual]: MANUAL_ADMIN
};

export function verifierFor(setting: VerifierSetting): AgeVerifier | null {
  return VERIFIER_OF[setting];
}

export type VerifyOutcome = { ok: true } | { ok: false; error: 'age_not_verified' };

export async function verifyAge(verifier: AgeVerifier, store: AgeVerificationStore, userId: string): Promise<VerifyOutcome> {
  const verdict = await verifier.check(userId);
  if (!verdict.adult) {
    return { ok: false, error: 'age_not_verified' };
  }
  await store.save({ userId, provider: verifier.key, method: verdict.method });
  return { ok: true };
}
