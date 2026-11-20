import { FOR_HUB } from '$lib/site/topics';
import { topicPath } from '$lib/site/topics/topic';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => Object.keys(FOR_HUB.topics).map((slug) => ({ slug }));

export const load: PageLoad = ({ params }) => ({ topic: FOR_HUB.topics[params.slug], path: topicPath(FOR_HUB, params.slug) });
