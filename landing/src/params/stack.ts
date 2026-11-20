import type { ParamMatcher } from '@sveltejs/kit';
import { FOR_HUB } from '$lib/site/topics';

export const match: ParamMatcher = (param) => Object.hasOwn(FOR_HUB.topics, param);
