import { planOf, type FigmaPlan } from '$lib/canvas/figma/figma-doc';
import { familyFor } from '$lib/motion/vector-ui/piece';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { restMessage, type RestNode, type RestPaint } from '$lib/server/figma/rest-message';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { PageTree } from './page-tree';
import { repeatedOf } from './repeated';

const FILE_KEY = 'url-import';
const MAX_IMAGES = 60;
const MAX_NAME = 80;
const HEX_WIDTH = 8;

export type ImageRefs = Record<string, string>;
export type ComponentCount = { components: number; instances: number };
export type UrlPlan = { plan: FigmaPlan; images: ImageRefs; name: string; components: ComponentCount };

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

function countOf(doc: MotionDoc): ComponentCount {
  const mains = new Set(Object.entries(doc.comps).flatMap(([id, c]) => (c.component ? [id] : [])));
  const clips = [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips);
  const uses = clips.filter((c) => mains.has(String(c.props.comp))).length;
  return { components: mains.size, instances: uses - mains.size };
}

export type Marker = (root: RestNode) => RestNode;

const REPEATED: Marker = (root) => repeatedOf(root).root;

export function urlPlan(tree: PageTree, newId: () => string, mark: Marker = REPEATED): UrlPlan | null {
  const name = (tree.title || new URL(tree.url).hostname).slice(0, MAX_NAME);
  const images = refsOf(tree.root);
  const keyOf = new Map(Object.entries(images).map(([key, url]) => [url, key]));
  const root = mapped({ ...mark(tree.root), name }, keyOf);
  const plan = planOf(restMessage([root], FILE_KEY), newId);
  return plan ? { plan: { ...plan, items: plan.items.map((item) => ({ ...item, name })) }, images, name, components: countOf(plan.items[0].doc) } : null;
}
