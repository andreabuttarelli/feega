import type { PageLoad } from './$types';
import { loadPageData } from '$lib/api/page-action';
import type { EditorPageData } from '$lib/server/frame-editor/editor-page';

export const ssr = false;

export const load: PageLoad = ({ url }) => loadPageData<EditorPageData>(url);
