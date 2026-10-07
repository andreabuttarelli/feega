import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { createServiceRoleDb } from '$lib/server/db/client';
import { SERVICE_ROLE_USES } from '$lib/server/db/service-role-uses';
import { cronAuthorized } from '$lib/server/cron-auth';
import { launchDeep } from '$lib/server/motion/deep/start';
import { DEEP_MAX_DURATION_S } from '$lib/server/motion/deep/limits';
import type { RequestHandler } from './$types';

export const config = { maxDuration: DEEP_MAX_DURATION_S };

const USE = SERVICE_ROLE_USES.find((u) => u.path.startsWith('src/routes/api/v1/motion/deep/resume'))!;
const HTTP_UNAUTHORIZED = 401;
const HTTP_BAD_REQUEST = 400;
const HTTP_ACCEPTED = 202;

const bodySchema = z.object({ runId: z.string().uuid() });

export const POST: RequestHandler = async ({ request }) => {
  if (!cronAuthorized(request)) {
    return json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED });
  }
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_run' }, { status: HTTP_BAD_REQUEST });
  }
  launchDeep(createServiceRoleDb(USE), body.data.runId);
  return json({ ok: true }, { status: HTTP_ACCEPTED });
};
