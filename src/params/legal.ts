import type { ParamMatcher } from '@sveltejs/kit';
import { isLegalSlug } from '$lib/site/legal';

export const match: ParamMatcher = (param) => isLegalSlug(param);
