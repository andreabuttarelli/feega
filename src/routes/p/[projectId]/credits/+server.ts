import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BILLING_PATH } from '$lib/billing-path';

export const GET: RequestHandler = () => {
  throw redirect(303, BILLING_PATH);
};
