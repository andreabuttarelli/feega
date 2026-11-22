import type { ParamMatcher } from '@sveltejs/kit';
import { INTEGRATIONS_HUB } from '$lib/site/topics';

export const match: ParamMatcher = (param) => Object.hasOwn(INTEGRATIONS_HUB.topics, param);
