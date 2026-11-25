import { ALT_LANDINGS, landingFor } from '$lib/site/alt-landings';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => ALT_LANDINGS.map((v) => ({ slug: v.slug }));

export const load: PageLoad = ({ params }) => ({ variant: landingFor(params.slug)! });
