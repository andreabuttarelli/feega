import { urlPlan, type UrlPlan } from '$lib/server/url-import/url-doc';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { ComponentUse } from './component-marks';
import { codeSets, withComponents } from './code-sets';

export function codePlan(tree: PageTree, uses: ComponentUse[], newId: () => string): UrlPlan | null {
  const refs = codeSets(uses);
  return urlPlan(tree, newId, (root) => withComponents(root, refs));
}
