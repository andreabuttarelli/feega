import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { figmaTokenStore, type FigmaTokenStore } from '$lib/server/figma/token-store';
import { figmaMe } from '$lib/server/figma/import-images';

const MIN_TOKEN = 8;
const MAX_TOKEN = 500;

type Locals = { supabase: unknown; safeGetSession: () => Promise<{ user: { id: string } | null }> };
type Ev = Pick<RequestEvent, 'request'> & { locals: Locals };

async function storeOf(locals: Locals): Promise<FigmaTokenStore | null> {
  const { user } = await locals.safeGetSession();
  return user ? figmaTokenStore(locals.supabase as Db, user.id) : null;
}

const unauthorized = () => fail(401, { figmaError: 'unauthorized' });

export async function hasFigmaToken(locals: Locals): Promise<boolean> {
  const store = await storeOf(locals);
  return store ? Boolean(await store.read().catch(() => null)) : false;
}

export async function saveFigmaToken({ request, locals }: Ev) {
  const store = await storeOf(locals);
  if (!store) {
    return unauthorized();
  }
  const token = String((await request.formData()).get('token') ?? '').trim();
  if (token.length < MIN_TOKEN || token.length > MAX_TOKEN) {
    return fail(400, { figmaError: 'invalid' });
  }
  return (await store.save(token)) ? { figmaSaved: true } : fail(503, { figmaError: 'unavailable' });
}

export async function testFigmaToken({ locals }: Ev) {
  const store = await storeOf(locals);
  if (!store) {
    return unauthorized();
  }
  const token = await store.read();
  if (!token) {
    return fail(409, { figmaError: 'none' });
  }
  const me = await figmaMe(fetch, token);
  return me.ok ? { figmaTested: me.handle } : fail(422, { figmaError: 'rejected' });
}

export async function removeFigmaToken({ locals }: Ev) {
  const store = await storeOf(locals);
  if (!store) {
    return unauthorized();
  }
  await store.remove();
  return { figmaRemoved: true };
}
