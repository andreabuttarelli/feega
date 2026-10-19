import { browserSupabase } from '$lib/api/client';
import { oauthReturnUrl } from './bundle-auth';

export enum OAuthProvider {
  Google = 'google',
  GitHub = 'github'
}

const LOCAL_ONLY = { scope: 'local' } as const;

export type AuthOutcome = { ok: true } | { ok: false; error: string };

function outcomeOf(error: { message: string } | null): AuthOutcome {
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signInWithPassword(email: string, password: string): Promise<AuthOutcome> {
  return outcomeOf((await browserSupabase().auth.signInWithPassword({ email, password })).error);
}

export async function signUpWithPassword(email: string, password: string): Promise<AuthOutcome> {
  return outcomeOf((await browserSupabase().auth.signUp({ email, password })).error);
}

export async function startOAuth(provider: OAuthProvider, next: string): Promise<AuthOutcome> {
  return outcomeOf((await browserSupabase().auth.signInWithOAuth({ provider, options: { redirectTo: oauthReturnUrl(next) } })).error);
}

export async function finishOAuth(code: string): Promise<AuthOutcome> {
  return outcomeOf((await browserSupabase().auth.exchangeCodeForSession(code)).error);
}

export async function signOutHere(): Promise<void> {
  await browserSupabase().auth.signOut(LOCAL_ONLY);
}
