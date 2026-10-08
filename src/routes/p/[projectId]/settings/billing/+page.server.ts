import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { BILLING_PATH } from '$lib/billing-path';

export const load: PageServerLoad = ({ url }) => {
  throw redirect(303, `${BILLING_PATH}${url.search}`);
};
