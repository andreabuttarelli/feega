import type { RequestHandler } from './$types';
import { Verdict, createDebugGate, debugBatchOf, recordDebugBatch } from '$lib/server/canvas-debug/debug-lines';

const MAX_BODY_BYTES = 64 * 1024;

enum Status {
  NoContent = 204,
  BadRequest = 400,
  Unauthorized = 401,
  TooLarge = 413,
  TooMany = 429
}

const admit = createDebugGate();

export const POST: RequestHandler = async ({ request, locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return new Response(null, { status: Status.Unauthorized });
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response(null, { status: Status.TooLarge });
  }

  const batch = debugBatchOf(body);
  if (!batch) {
    return new Response(null, { status: Status.BadRequest });
  }

  if (admit(user.id, batch.session, batch.lines.length) !== Verdict.Admit) {
    return new Response(null, { status: Status.TooMany });
  }

  try {
    await recordDebugBatch(batch, user.id, await locals.db());
  } catch (e) {
    console.warn('[canvas-debug] not recorded', batch.session, e);
  }
  return new Response(null, { status: Status.NoContent });
};
