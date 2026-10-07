import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE_S, THEME_METADATA_KEY, THEME_PREFS, type ThemePref } from '$lib/theme';

const HTTP_BAD_REQUEST = 400;
const HTTP_SERVER_ERROR = 500;

export const PUT: RequestHandler = async ({ request, cookies, locals }) => {
  const body = (await request.json().catch(() => ({}))) as { theme?: unknown };
  if (!THEME_PREFS.includes(body.theme as ThemePref)) {
    return json({ error: 'unknown theme' }, { status: HTTP_BAD_REQUEST });
  }
  const theme = body.theme as ThemePref;

  cookies.set(THEME_COOKIE, theme, { path: '/', maxAge: THEME_COOKIE_MAX_AGE_S, httpOnly: false, sameSite: 'lax' });

  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ theme });
  }
  const { error } = await locals.supabase.auth.updateUser({ data: { [THEME_METADATA_KEY]: theme } });
  return error ? json({ error: 'not saved' }, { status: HTTP_SERVER_ERROR }) : json({ theme });
};
