import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const HTTP_SEE_OTHER = 303;

export const load: PageServerLoad = () => {
  throw redirect(HTTP_SEE_OTHER, '/app/settings/api-keys');
};
