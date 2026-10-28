import * as Sentry from '@sentry/sveltekit';
import type { RequestHandler } from './$types';

const CRASH_KIND = 'webcontent-crash-suspected';
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TEXT = 120;

enum Status {
  NoContent = 204,
  BadRequest = 400,
  TooLarge = 413
}

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

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response(null, { status: Status.TooLarge });
  }

  const sample = flat(body);
  if (!sample) {
    return new Response(null, { status: Status.BadRequest });
  }

  console.warn(`[canvas] ${CRASH_KIND}`, JSON.stringify(sample));
  Sentry.captureMessage(CRASH_KIND, { level: 'warning', tags: { kind: CRASH_KIND, device: String(sample.device ?? '') }, extra: sample });
  return new Response(null, { status: Status.NoContent });
};
