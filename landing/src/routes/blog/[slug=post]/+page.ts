import { POSTS } from '$lib/site/posts';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => Object.keys(POSTS).map((slug) => ({ slug }));

export const load: PageLoad = ({ params }) => ({ slug: params.slug, post: POSTS[params.slug] });
