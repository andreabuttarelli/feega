import type { RequestHandler } from './$types';
import { createPerfGate, perfSummaryOf } from '$lib/server/canvas-perf';
import { ProductEvent, track } from '$lib/server/product-events/track';

const MAX_BODY_BYTES = 8 * 1024;

enum Status {
  NoContent = 204,
  BadRequest = 400,
  Unauthorized = 401,
  TooLarge = 413,
  TooMany = 429
}

const admit = createPerfGate();

export const POST: RequestHandler = async ({ request, locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return new Response(null, { status: Status.Unauthorized });
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response(null, { status: Status.TooLarge });
  }

  const summary = perfSummaryOf(body);
  if (!summary) {
    return new Response(null, { status: Status.BadRequest });
  }

  if (!admit(user.id)) {
    return new Response(null, { status: Status.TooMany });
  }

  await track(ProductEvent.CanvasPerf, { userId: user.id }, summary);
  return new Response(null, { status: Status.NoContent });
};
