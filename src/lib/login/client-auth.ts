import { goto } from '$app/navigation';
import { createSupabaseBrowserClient } from '$lib/supabase/client';
import { NATIVE_AUTH_BASE } from '$lib/native-shell';
import { HOSTED_ORIGIN } from '$lib/runtime';
import { call, chooseWorkspace, withOrg } from '$lib/dashboard/api';
import { inBundle, LOGIN_PATH } from '$lib/native/bundle-routes';

export type AuthRefusal = { errorCode?: string; error?: string };

export enum OAuthProvider {
  Google = 'google',
  GitHub = 'github'
}

const GENERIC_SIGN_IN = /invalid login|not confirmed/i;

export function signInRefusal(message: string): AuthRefusal {
  return GENERIC_SIGN_IN.test(message) ? { errorCode: 'invalidCredentials' } : { error: message };
}

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; body: AuthRefusal & Record<string, unknown> }> {
  const res = await fetch(`${HOSTED_ORIGIN}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

export async function signIn(email: string, password: string): Promise<AuthRefusal | null> {
  const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return error ? signInRefusal(error.message) : null;
}

export async function signUp(email: string, password: string): Promise<AuthRefusal | null> {
  const created = await postJson('/api/v1/auth/signup', { email, password });
  if (!created.ok) {
    return created.body;
  }
  return signIn(email, password);
}

export async function sendReset(email: string, locale: string): Promise<AuthRefusal | null> {
  const sent = await postJson('/api/v1/auth/reset', { email, locale });
  return sent.ok ? null : sent.body;
}

export async function startOAuth(provider: OAuthProvider): Promise<AuthRefusal | null> {
  const { data, error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${NATIVE_AUTH_BASE}/callback`, skipBrowserRedirect: true }
  });
  if (error || !data.url) {
    return { error: error?.message ?? `Could not start ${provider} sign-in` };
  }
  location.href = data.url;
  return null;
}

export async function finishOAuth(code: string): Promise<AuthRefusal | null> {
  const { error } = await createSupabaseBrowserClient().auth.exchangeCodeForSession(code);
  return error ? { error: error.message } : null;
}

export async function openHosted(path: string): Promise<void> {
  const { status, body } = await call('/api/v1/me/handoff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ next: path }) });
  if (status >= 400 || typeof body.url !== 'string') {
    await goto(LOGIN_PATH);
    return;
  }
  location.href = body.url;
}

export async function follow(path: string): Promise<void> {
  const url = new URL(path, location.href);
  if (inBundle(url.pathname)) {
    await goto(url.pathname + url.search);
    return;
  }
  await openHosted(url.pathname + url.search);
}

export async function land(): Promise<void> {
  const { status, body } = await call(withOrg('/api/v1/me/landing'));
  if (status >= 400 || typeof body.redirect !== 'string') {
    await goto(LOGIN_PATH);
    return;
  }
  if (typeof body.org === 'string') {
    chooseWorkspace(body.org);
  }
  await follow(body.redirect);
}
