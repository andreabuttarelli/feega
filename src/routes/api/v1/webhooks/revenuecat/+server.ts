import { timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { readRevenueCatEvent, SandboxPolicy } from '$lib/server/billing/revenuecat';
import { applyStoreChange } from '$lib/server/billing/store-entitlements';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR = 500;
const HTTP_UNAVAILABLE = 503;

const WEBHOOK_PATH = 'src/routes/api/v1/webhooks/revenuecat/+server.ts';

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function serviceUse() {
  const use = SERVICE_ROLE_USES.find((entry) => entry.path.startsWith(WEBHOOK_PATH));
  if (!use) {
    throw new Error(`service role use not declared: ${WEBHOOK_PATH}`);
  }
  return use;
}

export const POST: RequestHandler = async ({ request }) => {
  const secret = env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    return json({ error: 'revenuecat_not_configured' }, { status: HTTP_UNAVAILABLE });
  }
  if (!authorized(request.headers.get('authorization'), secret)) {
    return json({ error: 'unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }

  const body = await request.json().catch(() => null);
  const sandbox = env.REVENUECAT_SANDBOX === SandboxPolicy.Accept ? SandboxPolicy.Accept : SandboxPolicy.Ignore;
  const reading = readRevenueCatEvent(body, sandbox);

  if (reading.kind === 'invalid') {
    return json({ error: reading.reason }, { status: HTTP_BAD_REQUEST });
  }
  if (reading.kind === 'ignore') {
    return json({ ok: true, outcome: 'ignored', reason: reading.reason });
  }

  try {
    const outcome = await applyStoreChange(createServiceRoleDb(serviceUse()), reading.change);
    if (outcome === 'unknown_org') {
      return json({ ok: true, outcome: 'ignored', reason: outcome });
    }
    return json({ ok: true, outcome });
  } catch (e) {
    console.error('[revenuecat] apply failed', reading.change.eventId, e);
    return json({ error: 'apply_failed' }, { status: HTTP_SERVER_ERROR });
  }
};
