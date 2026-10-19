import type { PageLoad } from './$types';
import { loadPageData } from '$lib/api/page-action';
import type { BatchData } from '$lib/server/studio/batch-page';

export const load: PageLoad = ({ url, params, depends }) => {
  depends(`studio:batch:${params.batchId}`);
  return loadPageData<BatchData>(url);
};
