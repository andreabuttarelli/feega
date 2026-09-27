import { redirect } from '@sveltejs/kit';
import { takeOAuthReturn } from '$lib/server/oauth';
import { ENTRY_DEPS, homePathFor } from '$lib/server/tenancy/entry';
import { ORG_COOKIE } from '$lib/server/tenancy/context';
import type { RequestHandler } from './$types';

// Scambia il codice del magic link / OAuth per una sessione, poi instrada. Le destinazioni sono
// tre: chi stava facendo altro (consenso OAuth, login del CLI) torna lì, tutti gli altri alla
// propria tela — che apre da sé, senza parametri da portarsi dietro.
export const GET: RequestHandler = async ({ url, cookies, locals: { supabase, db } }) => {
  const code = url.searchParams.get('code');
  if (!code) {
    throw redirect(303, '/login');
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    throw redirect(303, '/login?error=link');
  }
  const user = data?.user;

  const oauthReturn = takeOAuthReturn(cookies);
  if (oauthReturn) {
    throw redirect(303, oauthReturn);
  }

  const cliPort = url.searchParams.get('cli_port') ?? '';
  const cliState = url.searchParams.get('cli_state') ?? '';
  if (cliPort) {
    throw redirect(
      303,
      `/cli/callback?cli_port=${encodeURIComponent(cliPort)}&cli_state=${encodeURIComponent(cliState)}`
    );
  }

  const dbClient = user ? await db() : null;
  throw redirect(303, dbClient && user ? await homePathFor(dbClient, ENTRY_DEPS, user, cookies.get(ORG_COOKIE) ?? null) : '/app');
};
