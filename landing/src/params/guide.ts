import type { ParamMatcher } from '@sveltejs/kit';
import { isGuideSlug } from '$lib/site/guides';

export const match: ParamMatcher = (param) => isGuideSlug(param);
