import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { readAgentMemory, saveAgentMemory } from '$lib/server/repos/profiles';
import { MEMORY_MAX_CHARS } from '$lib/onboarding/limits';

const UNAUTHORIZED = 401;
const PAYLOAD_TOO_LARGE = 413;
const FORM_LINE_BREAK = /\r\n?/g;

type Locals = { supabase: unknown; safeGetSession: () => Promise<{ user: { id: string } | null }> };
type Ev = Pick<RequestEvent, 'request'> & { locals: Locals };

export async function readMemory(locals: Locals): Promise<string> {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return '';
  }

  return (await readAgentMemory(locals.supabase as Db, user.id).catch(() => null)) ?? '';
}

export async function saveMemory({ request, locals }: Ev) {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return fail(UNAUTHORIZED, { memoryError: 'unauthorized' });
  }

  const content = String((await request.formData()).get('content') ?? '').replace(FORM_LINE_BREAK, '\n').trim();
  if (content.length > MEMORY_MAX_CHARS) {
    return fail(PAYLOAD_TOO_LARGE, { memoryError: 'too_long' });
  }

  await saveAgentMemory(locals.supabase as Db, user.id, content);
  return { memorySaved: true };
}
