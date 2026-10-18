import type { ParamMatcher } from '@sveltejs/kit';
import { isLandingSlug } from '$lib/site/landing';

export const match: ParamMatcher = (param) => isLandingSlug(param);
