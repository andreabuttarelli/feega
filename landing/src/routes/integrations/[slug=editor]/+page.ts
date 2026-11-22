import { INTEGRATIONS_HUB } from '$lib/site/topics';
import { topicPath } from '$lib/site/topics/topic';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => Object.keys(INTEGRATIONS_HUB.topics).map((slug) => ({ slug }));

export const load: PageLoad = ({ params }) => ({ topic: INTEGRATIONS_HUB.topics[params.slug], path: topicPath(INTEGRATIONS_HUB, params.slug) });
