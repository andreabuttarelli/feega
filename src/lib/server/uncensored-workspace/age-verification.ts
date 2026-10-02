export type AgeStart = { adult: true; method: string } | { redirect: string };

export type AgeVerifier = {
  key: string;
  start(userId: string, returnUrl: string): Promise<AgeStart>;
};

export type AgeRow = { userId: string; provider: string; method: string; sessionId: string | null };

export type AgeVerificationStore = {
  save(row: AgeRow): Promise<void>;
  isVerified(userId: string): Promise<boolean>;
};

export enum VerifierSetting {
  None = 'none',
  DevManual = 'dev_manual'
}

const HOSTED_METHOD = 'age_check';

export const MANUAL_ADMIN: AgeVerifier = {
  key: 'manual_admin',
  start: async () => ({ adult: true, method: 'manual_admin' })
};

const VERIFIER_OF: Readonly<Record<VerifierSetting, AgeVerifier | null>> = {
  [VerifierSetting.None]: null,
  [VerifierSetting.DevManual]: MANUAL_ADMIN
};

export function verifierFor(setting: VerifierSetting): AgeVerifier | null {
  return VERIFIER_OF[setting];
}

export type VerifyOutcome = { ok: true } | { ok: false; redirect: string };

export async function verifyAge(verifier: AgeVerifier, store: AgeVerificationStore, userId: string, returnUrl: string): Promise<VerifyOutcome> {
  const started = await verifier.start(userId, returnUrl);
  if ('redirect' in started) {
    return { ok: false, redirect: started.redirect };
  }
  await store.save({ userId, provider: verifier.key, method: started.method, sessionId: null });
  return { ok: true };
}

export async function recordAdult(store: AgeVerificationStore, input: { provider: string; userId: string; sessionId: string }): Promise<void> {
  await store.save({ userId: input.userId, provider: input.provider, method: HOSTED_METHOD, sessionId: input.sessionId });
}
