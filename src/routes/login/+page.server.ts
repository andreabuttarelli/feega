import { fail, redirect } from '@sveltejs/kit';
import { EMAIL_RE, createConfirmedAccount, sendPasswordReset } from '$lib/server/auth/accounts';
import { sanitizeWebsiteParam } from '$lib/website-param';
import { appOrigin } from '$lib/server/app-url';
import { takeOAuthReturn } from '$lib/server/oauth';
import { INVITE_ERROR_PARAM, INVITE_PARAM, inviteTokenIn, landingPath } from '$lib/server/tenancy/landing';
import { signInErrorIn } from './sign-in-error';
import { NATIVE_AUTH_BASE, isNativeShell } from '$lib/native-shell';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';


/** Homepage/ads URL CTA, pricing plan CTA → open create-account, not sign-in. */
function preferSignup(url: URL): boolean {
  if (url.searchParams.get('next') === 'onboarding') return true;
  if (url.searchParams.get('mode') === 'signup') return true;
  if (sanitizeWebsiteParam(url.searchParams.get('website'))) return true;
  return false;
}

const INVITE_ERRORS = ['invalid', 'wrong_email'] as const;
type InviteError = (typeof INVITE_ERRORS)[number];

function inviteErrorIn(url: URL): InviteError | null {
  const code = url.searchParams.get(INVITE_ERROR_PARAM);
  return INVITE_ERRORS.find((known) => known === code) ?? null;
}

export const load: PageServerLoad = async ({ url, cookies, locals: { safeGetSession, db } }) => {
  const cliPort = url.searchParams.get('cli_port') ?? '';
  const cliState = url.searchParams.get('cli_state') ?? '';
  const inviteToken = inviteTokenIn(url.searchParams);
  const inviteError = inviteErrorIn(url);
  const signInError = signInErrorIn(url);
  const page = { cliPort, cliState, inviteToken, inviteError, signInError, homeHref: null as string | null, preferSignup: preferSignup(url) };

  const { session, user } = await safeGetSession();
  const client = session && user ? await db() : null;
  if (!user || !client) {
    return page;
  }

  if (inviteError) {
    return { ...page, homeHref: await landingPath(client, user, cookies, null) };
  }

  const oauthReturn = takeOAuthReturn(cookies);
  if (oauthReturn) throw redirect(303, oauthReturn);
  if (cliPort) throw redirect(303, `/cli/callback?cli_port=${cliPort}&cli_state=${cliState}`);
  throw redirect(303, await landingPath(client, user, cookies, inviteToken));
};

// Public origin for absolute email / OAuth links. Prefer the live request host (www vs apex)
// so Supabase redirect allow-lists match; see appOrigin().
function appBase(url: URL): string {
  return appOrigin(url);
}

// Dopo un accesso riuscito (stessa logica della callback OAuth): il CLI alla sua callback,
// tutti gli altri all'app. Lancia sempre.
async function routeAfterAuth(
  data: FormData,
  cliPort: string,
  cliState: string,
  cookies: Cookies,
  locals: RequestEvent['locals']
): Promise<never> {
  // An interrupted /oauth/authorize resumes here (MCP client connect → login → consent).
  const oauthReturn = takeOAuthReturn(cookies);
  if (oauthReturn) throw redirect(303, oauthReturn);

  if (cliPort) {
    throw redirect(303, `/cli/callback?cli_port=${encodeURIComponent(cliPort)}&cli_state=${encodeURIComponent(cliState)}`);
  }

  const { user } = await locals.safeGetSession();
  const db = user ? await locals.db() : null;
  if (!user || !db) {
    throw redirect(303, '/login');
  }
  throw redirect(303, await landingPath(db, user, cookies, inviteTokenIn(data)));
}

export const actions: Actions = {
  // Email + password sign-in. Wrong creds come back as a generic code (no account enumeration).
  login: async ({ request, cookies, locals }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const password = String(data.get('password') ?? '');
    const cliPort = String(data.get('cli_port') ?? '');
    const cliState = String(data.get('cli_state') ?? '');

    if (!EMAIL_RE.test(email)) return fail(400, { errorCode: 'invalidEmail', email });
    if (!password) return fail(400, { errorCode: 'invalidCredentials', email });

    const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // "Invalid login credentials" / "Email not confirmed" → one generic message.
      const code = /invalid login|not confirmed/i.test(error.message) ? 'invalidCredentials' : null;
      return code ? fail(400, { errorCode: code, email }) : fail(400, { error: error.message, email });
    }

    return routeAfterAuth(data, cliPort, cliState, cookies, locals);
  },

  // Sign-up. We create an already-confirmed user via the admin API (no confirmation email — the
  // product decision is instant login) and then sign in on the SSR client to set the session
  // cookies. This is robust to the dashboard "Confirm email" toggle either way.
  signup: async ({ request, cookies, locals }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    const password = String(data.get('password') ?? '');
    const cliPort = String(data.get('cli_port') ?? '');
    const cliState = String(data.get('cli_state') ?? '');

    const refused = await createConfirmedAccount(email, password);
    if (refused) return fail(400, { ...refused, email });

    const { error: signErr } = await locals.supabase.auth.signInWithPassword({ email, password });
    if (signErr) return fail(400, { error: signErr.message, email });

    return routeAfterAuth(data, cliPort, cliState, cookies, locals);
  },

  // Forgot-password. Generate a recovery link server-side (service role) and email it ourselves via
  // Resend — we never use Supabase's built-in mailer. We verify the token at /auth/confirm, so the
  // link points straight there (no redirect-allow-list config needed). Always returns the same
  // "sent" state, even for unknown emails, to avoid account enumeration.
  reset: async ({ request, url }) => {
    const data = await request.formData();
    const email = String(data.get('email') ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return fail(400, { errorCode: 'invalidEmail', email });

    await sendPasswordReset({ email, locale: String(data.get('locale') ?? ''), base: appBase(url), inviteToken: inviteTokenIn(data) });

    return { reset: true, email };
  },

  // GitHub / Google OAuth. Returns a provider URL to bounce through; the PKCE verifier is stashed in
  // cookies by the SSR client, and /auth/callback exchanges the code on return.
  github: (event) => oauthSignIn(event, 'github'),
  google: (event) => oauthSignIn(event, 'google')
};

function buildRedirectTo(authBase: string, cliPort: string, cliState: string, inviteToken: string | null): string {
  const cb = new URLSearchParams();
  if (cliPort) {
    cb.set('cli_port', cliPort);
    cb.set('cli_state', cliState);
  }
  if (inviteToken) {
    cb.set(INVITE_PARAM, inviteToken);
  }
  return `${authBase}/callback${cb.toString() ? `?${cb}` : ''}`;
}

// Shared OAuth kickoff: ask Supabase for the provider URL and bounce the browser there.
async function oauthSignIn({ request, locals: { supabase }, url }: RequestEvent, provider: 'github' | 'google') {
  const data = await request.formData();
  const cliPort = String(data.get('cli_port') ?? '');
  const cliState = String(data.get('cli_state') ?? '');
  const authBase = isNativeShell(request.headers.get('user-agent')) ? NATIVE_AUTH_BASE : `${appBase(url)}/auth`;
  const redirectTo = buildRedirectTo(authBase, cliPort, cliState, inviteTokenIn(data));
  const { data: oauth, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });

  if (error || !oauth?.url) return fail(400, { error: error?.message ?? `Could not start ${provider} sign-in` });
  throw redirect(303, oauth.url);
}
