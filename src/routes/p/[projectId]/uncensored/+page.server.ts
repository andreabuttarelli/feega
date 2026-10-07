import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const HTTP_MOVED_PERMANENTLY = 308;

export const load: PageServerLoad = ({ params }) => {
  throw redirect(HTTP_MOVED_PERMANENTLY, `/p/${params.projectId}/settings/project`);
};
