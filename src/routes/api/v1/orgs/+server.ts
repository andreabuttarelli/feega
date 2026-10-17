import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { bearerOf } from '$lib/server/api/bearer-page';
import { CREATE_DEPS, createOrg, CreateOutcome, orgsOf } from '$lib/server/team/orgs';
import { FREE_ORGS_PER_USER } from '$lib/credit-ladder';
import { BILLING_PATH } from '$lib/billing-path';
import type { RequestHandler } from './$types';

const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_PAYMENT_REQUIRED = 402;

const CREATE_REFUSAL: Record<Exclude<CreateOutcome, CreateOutcome.Created>, { status: number; message: string }> = {
  [CreateOutcome.InvalidName]: { status: HTTP_BAD_REQUEST, message: 'Give the organisation a name.' },
  [CreateOutcome.FreeLimit]: {
    status: HTTP_PAYMENT_REQUIRED,
    message: `You already have ${FREE_ORGS_PER_USER} free organisations. Upgrade one of them (${BILLING_PATH}) to create another.`
  }
};

const bodySchema = z.object({ name: z.string() });

export const GET: RequestHandler = async ({ request }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }
  return json({ orgs: await orgsOf(bearer.db, bearer.user.id) });
};

export const POST: RequestHandler = async ({ request }) => {
  const bearer = await bearerOf(request);
  if (bearer instanceof Response) {
    return bearer;
  }

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  const created = await createOrg(bearer.db, CREATE_DEPS, { userId: bearer.user.id, name: body.success ? body.data.name : '' });
  if (created.outcome !== CreateOutcome.Created) {
    const refusal = CREATE_REFUSAL[created.outcome];
    return json({ error: created.outcome, message: refusal.message, upgrade_path: BILLING_PATH }, { status: refusal.status });
  }
  return json({ org_id: created.orgId }, { status: HTTP_CREATED });
};
