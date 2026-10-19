import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { nativeAppleSignIn, NativeAppleOutcome, APPLE_AUTHORIZE_COMMAND } from './native';

describe('native Sign in with Apple', () => {
  it('Apple gets the hashed nonce, the server the raw one with the identity token', async () => {
    let sentToApple = '';
    let sentToSupabase: { provider: string; token: string; nonce: string } | null = null;

    const outcome = await nativeAppleSignIn({
      invoke: async (command, args) => {
        expect(command).toBe(APPLE_AUTHORIZE_COMMAND);
        sentToApple = args.nonce;
        return { identityToken: 'id.jwt' };
      },
      submitIdToken: (credentials) => {
        sentToSupabase = credentials;
      }
    });

    expect(outcome).toBe(NativeAppleOutcome.Submitted);
    expect(sentToSupabase!.provider).toBe('apple');
    expect(sentToSupabase!.token).toBe('id.jwt');
    expect(createHash('sha256').update(sentToSupabase!.nonce).digest('hex')).toBe(sentToApple);
  });

  it('a shell without the plugin falls back to the web flow', async () => {
    const outcome = await nativeAppleSignIn({ invoke: null, submitIdToken: () => {} });
    expect(outcome).toBe(NativeAppleOutcome.Unavailable);
  });

  it('a cancelled sheet submits nothing', async () => {
    let submitted = false;
    const outcome = await nativeAppleSignIn({
      invoke: async () => {
        throw new Error('cancelled');
      },
      submitIdToken: () => {
        submitted = true;
      }
    });
    expect(outcome).toBe(NativeAppleOutcome.Failed);
    expect(submitted).toBe(false);
  });
});
