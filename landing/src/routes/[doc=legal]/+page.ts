import { LEGAL_DOCS, type LegalSlug } from '$lib/site/legal';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => LEGAL_DOCS[params.doc as LegalSlug];
