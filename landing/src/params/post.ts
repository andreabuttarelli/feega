import type { ParamMatcher } from '@sveltejs/kit';
import { isPostSlug } from '$lib/site/posts';

export const match: ParamMatcher = (param) => isPostSlug(param);
