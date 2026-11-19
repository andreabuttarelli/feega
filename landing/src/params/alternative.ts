import type { ParamMatcher } from '@sveltejs/kit';
import { isAlternativeSlug } from '$lib/site/alternatives';

export const match: ParamMatcher = (param) => isAlternativeSlug(param);
