import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bearerOf } from '$lib/server/api/bearer-page';
import { readAgentMemory, saveAgentMemory } from '$lib/server/repos/profiles';
import { MEMORY_MAX_CHARS } from '$lib/onboarding/limits';

const BAD_REQUEST = 400;
const PAYLOAD_TOO_LARGE = 413;

export const GET: RequestHandler = async ({ request }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  return json({ content: await readAgentMemory(bearer.db, bearer.user.id) });
};

export const PUT: RequestHandler = async ({ request }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  if (typeof body?.content !== 'string') {
    return json({ error: 'invalid_memory' }, { status: BAD_REQUEST });
  }
  if (body.content.length > MEMORY_MAX_CHARS) {
    return json({ error: 'memory_too_long' }, { status: PAYLOAD_TOO_LARGE });
  }

  await saveAgentMemory(bearer.db, bearer.user.id, body.content);
  return json({ saved: true });
};
