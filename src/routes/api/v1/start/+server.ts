import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { ENTRY_DEPS, startProject } from '$lib/server/tenancy/entry';
import { ORG_COOKIE } from '$lib/server/tenancy/context';
import { assertPublicUrl } from '$lib/server/tool-guard';
import { START_URL_MAX, startUrlOf } from '$lib/start-url';
import type { RequestHandler } from './$types';

const BAD_REQUEST = 400;
const UNAUTHENTICATED = 401;

const askSchema = z.object({ url: z.string().min(1).max(START_URL_MAX) });

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  const { user } = await locals.safeGetSession();
  const db = user ? await locals.db() : null;
  if (!user || !db) {
    return json({ error: 'unauthenticated' }, { status: UNAUTHENTICATED });
  }

  const ask = askSchema.safeParse(await request.json().catch(() => null));
  const url = ask.success ? startUrlOf(ask.data.url) : null;
  const reachable = url ? await assertPublicUrl(new URL(url)).then(() => true, () => false) : false;
  if (!url || !reachable) {
    return json({ error: 'not_public' }, { status: BAD_REQUEST });
  }

  return json(await startProject(db, ENTRY_DEPS, user, cookies.get(ORG_COOKIE) ?? null, url));
};
