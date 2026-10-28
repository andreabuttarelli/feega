import * as Sentry from '@sentry/sveltekit';
import type { RequestHandler } from './$types';
import { createCrashGate, Verdict } from '$lib/server/crash-gate';

const CRASH_KIND = 'webcontent-crash-suspected';
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TEXT = 120;

enum Status {
  NoContent = 204,
  BadRequest = 400,
  Unauthorized = 401,
  TooLarge = 413,
  TooMany = 429
}

const admit = createCrashGate();

type Flat = Record<string, number | string>;

const kept = (value: unknown) => (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= MAX_TEXT);

function flat(body: string): Flat | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => kept(v))) as Flat;
  } catch {
    return null;
  }
}

export const POST: RequestHandler = async ({ request, locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) {
    return new Response(null, { status: Status.Unauthorized });
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response(null, { status: Status.TooLarge });
  }

  const sample = flat(body);
  if (!sample) {
    return new Response(null, { status: Status.BadRequest });
  }

  const verdict = admit(user.id);
  if (verdict === Verdict.OverLimit) {
    return new Response(null, { status: Status.TooMany });
  }
  if (verdict === Verdict.Drop) {
    return new Response(null, { status: Status.NoContent });
  }

  const device = String(sample.device ?? '');
  console.warn(`[canvas] ${CRASH_KIND}`, JSON.stringify(sample));
  Sentry.captureMessage(CRASH_KIND, { level: 'warning', fingerprint: [CRASH_KIND, device], tags: { kind: CRASH_KIND, device }, extra: sample });
  return new Response(null, { status: Status.NoContent });
};
