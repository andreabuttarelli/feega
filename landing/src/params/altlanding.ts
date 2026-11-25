import type { ParamMatcher } from '@sveltejs/kit';
import { isAltLandingSlug } from '$lib/site/alt-landings';

export const match: ParamMatcher = (param) => isAltLandingSlug(param);
