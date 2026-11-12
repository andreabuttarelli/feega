import { baselined } from '$lib/canvas/code-look';
import { urlPlan, type FontAssets, type UrlPlan } from '$lib/server/url-import/url-doc';
import { componentPages } from '$lib/server/url-import/component-sheet';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { ComponentUse } from './component-marks';
import { codeSets, innerOf, linkable, withComponents, type DeclaredAxes } from './code-sets';

export function codePlan(tree: PageTree, uses: ComponentUse[], newId: () => string, fonts: FontAssets = {}, declared: DeclaredAxes = new Map()): UrlPlan | null {
  const refs = codeSets(uses, declared);
  const inner = innerOf(uses);
  const made = urlPlan(tree, newId, (root) => linkable(withComponents(root, refs, inner)), fonts);
  const based = made ? { ...made, plan: { ...made.plan, items: made.plan.items.map((item) => ({ ...item, doc: baselined(item.doc) })) } } : null;
  return based ? { ...based, ...componentPages(based.plan.items, newId) } : null;
}
