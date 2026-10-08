import { json } from '@sveltejs/kit';
import { socialPublishing } from '$lib/server/social-publishing';
import { publishes } from '$lib/social-publishing';

export const GET = async () => json({ social_publishing: publishes(await socialPublishing()) });
