import { urlPlan, type FontAssets, type UrlPlan } from '$lib/server/url-import/url-doc';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { ComponentUse } from './component-marks';
import { codeSets, innerOf, linkable, withComponents } from './code-sets';

export function codePlan(tree: PageTree, uses: ComponentUse[], newId: () => string, fonts: FontAssets = {}): UrlPlan | null {
  const refs = codeSets(uses);
  const inner = innerOf(uses);
  return urlPlan(tree, newId, (root) => linkable(withComponents(root, refs, inner)), fonts);
}
