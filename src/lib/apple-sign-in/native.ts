import { appleNonce } from './nonce';

export const APPLE_AUTHORIZE_COMMAND = 'plugin:apple-sign-in|authorize';

export enum NativeAppleOutcome {
  Submitted = 'submitted',
  Unavailable = 'unavailable',
  Failed = 'failed'
}

type Invoke = (command: string, args: { nonce: string }) => Promise<{ identityToken: string }>;
export type AppleIdToken = { provider: 'apple'; token: string; nonce: string };

export type NativeAppleDeps = { invoke: Invoke | null; submitIdToken: (credentials: AppleIdToken) => void };

export async function nativeAppleSignIn({ invoke, submitIdToken }: NativeAppleDeps): Promise<NativeAppleOutcome> {
  if (!invoke) {
    return NativeAppleOutcome.Unavailable;
  }

  const nonce = await appleNonce();
  try {
    const { identityToken } = await invoke(APPLE_AUTHORIZE_COMMAND, { nonce: nonce.hashed });
    submitIdToken({ provider: 'apple', token: identityToken, nonce: nonce.raw });
    return NativeAppleOutcome.Submitted;
  } catch {
    return NativeAppleOutcome.Failed;
  }
}

type TauriWindow = { __TAURI_INTERNALS__?: { invoke: Invoke } };

export function tauriInvoke(win: unknown): Invoke | null {
  const internals = (win as TauriWindow).__TAURI_INTERNALS__;
  return internals ? (command, args) => internals.invoke(command, args) : null;
}
