import { PLUGINS } from '$lib/site/plugins/plugins';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({ plugins: PLUGINS });
