import { appleNonce } from './nonce';
import type { AppleAuthorize } from '$lib/native-bridge';

export enum NativeAppleOutcome {
  Submitted = 'submitted',
  Unavailable = 'unavailable',
  Failed = 'failed'
}

export type AppleIdToken = { provider: 'apple'; token: string; nonce: string };

export type NativeAppleDeps = { authorize: AppleAuthorize | null; submitIdToken: (credentials: AppleIdToken) => void };

export async function nativeAppleSignIn({ authorize, submitIdToken }: NativeAppleDeps): Promise<NativeAppleOutcome> {
  if (!authorize) {
    return NativeAppleOutcome.Unavailable;
  }

  const nonce = await appleNonce();
  try {
    const { identityToken } = await authorize(nonce.hashed);
    submitIdToken({ provider: 'apple', token: identityToken, nonce: nonce.raw });
    return NativeAppleOutcome.Submitted;
  } catch {
    return NativeAppleOutcome.Failed;
  }
}
