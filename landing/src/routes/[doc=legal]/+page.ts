import { LEGAL_DOCS, type LegalSlug } from '$lib/site/legal';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () => Object.keys(LEGAL_DOCS).map((doc) => ({ doc }));

export const load: PageLoad = ({ params }) => LEGAL_DOCS[params.doc as LegalSlug];
