import type { ParamMatcher } from '@sveltejs/kit';
import { isTemplateId } from '$lib/site/templates/library';

export const match: ParamMatcher = (param) => isTemplateId(param);
