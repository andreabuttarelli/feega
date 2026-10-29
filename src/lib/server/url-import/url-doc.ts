import { planOf, type FigmaPlan } from '$lib/canvas/figma/figma-doc';
import { familyFor } from '$lib/motion/vector-ui/piece';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { restMessage, type RestNode, type RestPaint } from '$lib/server/figma/rest-message';
import type { PageTree } from './page-tree';

const FILE_KEY = 'url-import';
const MAX_IMAGES = 60;
const MAX_NAME = 80;
const HEX_WIDTH = 8;

export type ImageRefs = Record<string, string>;
export type UrlPlan = { plan: FigmaPlan; images: ImageRefs; name: string };

const FAMILIES = GOOGLE_FONTS.map((f) => f.f);

const hexOf = (index: number) => index.toString(16).padStart(HEX_WIDTH, '0');

function refsOf(root: RestNode): ImageRefs {
  const keyOf = new Map<string, string>();
  const visit = (n: RestNode) => {
    for (const paint of n.fills ?? []) {
      if (paint.imageRef && !keyOf.has(paint.imageRef) && keyOf.size < MAX_IMAGES) {
        keyOf.set(paint.imageRef, hexOf(keyOf.size + 1));
      }
    }
    (n.children ?? []).forEach(visit);
  };
  visit(root);
  return Object.fromEntries([...keyOf].map(([url, key]) => [key, url]));
}

function mapped(n: RestNode, keyOf: Map<string, string>): RestNode {
  const fills = n.fills?.flatMap((p): RestPaint[] => (p.imageRef ? (keyOf.has(p.imageRef) ? [{ ...p, imageRef: keyOf.get(p.imageRef) }] : []) : [p]));
  const style = n.style?.fontFamily ? { ...n.style, fontFamily: familyFor(n.style.fontFamily, FAMILIES) } : n.style;
  return { ...n, fills, style, children: n.children?.map((c) => mapped(c, keyOf)) };
}

export function urlPlan(tree: PageTree, newId: () => string): UrlPlan | null {
  const name = (tree.title || new URL(tree.url).hostname).slice(0, MAX_NAME);
  const images = refsOf(tree.root);
  const keyOf = new Map(Object.entries(images).map(([key, url]) => [url, key]));
  const root = mapped({ ...tree.root, name }, keyOf);
  const plan = planOf(restMessage([root], FILE_KEY), newId);
  return plan ? { plan: { ...plan, items: plan.items.map((item) => ({ ...item, name })) }, images, name } : null;
}
