import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { bearerOf } from '$lib/server/api/bearer-page';
import { switchOrg, SwitchOutcome } from '$lib/server/team/orgs';
import type { RequestHandler } from './$types';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

const SWITCH_STATUS: Record<SwitchOutcome, number> = {
  [SwitchOutcome.Switched]: HTTP_OK,
  [SwitchOutcome.NotMember]: HTTP_NOT_FOUND
};

const bodySchema = z.object({ org_id: z.string().min(1) });

export const PUT: RequestHandler = async ({ request }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return json({ error: 'invalid_body' }, { status: HTTP_BAD_REQUEST });
  }

  const outcome = await switchOrg(bearer.db, { userId: bearer.user.id, orgId: body.data.org_id });
  return json({ outcome, org_id: body.data.org_id }, { status: SWITCH_STATUS[outcome] });
};
