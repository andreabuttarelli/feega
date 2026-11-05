import type { ParamMatcher } from '@sveltejs/kit';
import { isComparisonSlug } from '$lib/site/compare';

export const match: ParamMatcher = (param) => isComparisonSlug(param);
