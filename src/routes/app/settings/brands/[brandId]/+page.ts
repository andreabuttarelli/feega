import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { brandSettingsHref } from '$lib/components/settings/platforms';

const SEE_OTHER = 303;
const FIRST_SECTION = 'brand';

export const load: PageLoad = ({ params }) => {
  throw redirect(SEE_OTHER, brandSettingsHref(params.brandId, FIRST_SECTION));
};
