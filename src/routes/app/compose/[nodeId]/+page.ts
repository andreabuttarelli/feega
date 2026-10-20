import type { PageLoad } from './$types';
import { loadPageData } from '$lib/api/page-action';
import type { ComposeEditorData } from '$lib/server/compose/editor-page';

export const load: PageLoad = ({ url }) => loadPageData<ComposeEditorData>(url);
