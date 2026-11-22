import type { ParamMatcher } from '@sveltejs/kit';
import { isHubSlug } from '$lib/site/templates/paths';

export const match: ParamMatcher = (param) => isHubSlug(param);
