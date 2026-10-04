import { json } from '@sveltejs/kit';
import { DEFAULT_CHAT_CHOICE, groupByProvider } from '$lib/chat-model';
import { offeredChatModels, resolveChoice } from '$lib/server/chat-model/catalogue';
import { saveChoice, savedChoice } from '$lib/server/chat-model/preference';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'unauthenticated' }, { status: 401 });
  }

  const options = await offeredChatModels();
  const saved = resolveChoice(options, await savedChoice(locals.supabase.auth));
  const fallback = resolveChoice(options, {});
  const choice = saved.ok ? saved.choice : fallback.ok ? fallback.choice : DEFAULT_CHAT_CHOICE;
  return json({ groups: groupByProvider(options), choice });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return json({ error: 'unauthenticated' }, { status: 401 });
  }

  const asked = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const resolved = resolveChoice(await offeredChatModels(), { model: asked.model ?? null, reasoning: asked.reasoning });
  if (!resolved.ok) {
    return json({ error: resolved.error }, { status: 400 });
  }

  if (!(await saveChoice(locals.supabase.auth, resolved.choice))) {
    return json({ error: 'not_saved' }, { status: 500 });
  }
  return json({ choice: resolved.choice });
};
