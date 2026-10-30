import { planOf, type FigmaPlan, type FontUpload } from '$lib/canvas/figma/figma-doc';
import { catalogueFamily, familyFor } from '$lib/motion/vector-ui/piece';
import { GOOGLE_FONTS } from '$lib/motion/fonts/catalogue';
import { restMessage, type RestNode, type RestPaint, type RestStyle } from '$lib/server/figma/rest-message';
import { DESIGN_MAX_SIDE, type MotionDoc } from '@feega/motion-core/motion/doc';
import type { FontVariant } from '@feega/motion-core/motion/fonts/model';
import type { PageFont, PageTree } from './page-tree';
import { repeatedOf } from './repeated';
import { windowed } from './page-window';
import { sectionsOf } from './page-sections';
import { sectionFramed } from './section-frames';

const FILE_KEY = 'url-import';
const MAX_IMAGES = 200;
const MAX_NAME = 80;
const HEX_WIDTH = 8;
const MAX_FAMILY = 64;
const MAX_VARIANTS = 18;
const REGULAR = 400;
const ITALIC = /italic|oblique/;
const UNSAFE_FAMILY = /[^A-Za-z0-9 \-.']+/g;

export type ImageRefs = Record<string, string>;
export type FontAssets = Record<string, string>;
export type ComponentCount = { components: number; instances: number };
export type UrlPlan = { plan: FigmaPlan; images: ImageRefs; name: string; components: ComponentCount };

const FAMILIES = GOOGLE_FONTS.map((f) => f.f);

const hexOf = (index: number) => index.toString(16).padStart(HEX_WIDTH, '0');

const familyKey = (family: string) => family.replace(/["']/g, '').trim().toLowerCase();

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

type Use = { family: string; weight: number; italic: boolean };

function usesOf(root: RestNode): Use[] {
  const uses: Use[] = [];
  const add = (style: RestStyle | undefined) => {
    if (style?.fontFamily) {
      uses.push({ family: style.fontFamily, weight: Math.round(style.fontWeight ?? REGULAR), italic: Boolean(style.italic) });
    }
  };
  const visit = (n: RestNode) => {
    if (n.type === 'TEXT') {
      add(n.style);
      Object.values(n.styleOverrideTable ?? {}).forEach(add);
    }
    (n.children ?? []).forEach(visit);
  };
  visit(root);
  return uses;
}

const weightsOf = (face: PageFont) => face.weight.split(/\s+/).map(Number).filter(Number.isFinite);

function faceFor(use: Use, faces: PageFont[]): PageFont | null {
  const own = faces.filter((f) => familyKey(f.family) === familyKey(use.family) && ITALIC.test(f.style) === use.italic);
  const distance = (f: PageFont) => {
    const [lo, hi = lo] = weightsOf(f);
    return use.weight >= lo && use.weight <= hi ? 0 : Math.min(Math.abs(use.weight - lo), Math.abs(use.weight - hi));
  };
  return own.sort((a, b) => distance(a) - distance(b))[0] ?? null;
}

const embeddable = (faces: PageFont[]) => (use: Use) => !use.family.includes(',') && faces.some((f) => familyKey(f.family) === familyKey(use.family));

export function fontsWanted(tree: PageTree): PageFont[] {
  const faces = tree.fonts ?? [];
  const wanted = usesOf(tree.root).filter(embeddable(faces)).flatMap((use) => faceFor(use, faces) ?? []);
  return [...new Map(wanted.map((f) => [`${f.family}|${f.weight}|${f.style}|${f.url}`, f])).values()];
}

const STAND_INS: [RegExp, string][] = [
  [/^(-apple-system|blinkmacsystemfont|system-ui|ui-sans-serif|segoe ui|sf pro.*|\.?sf ns.*)$/, 'Inter'],
  [/^(helvetica( neue)?|arial|liberation sans)$/, 'Arimo'],
  [/^(times( new roman)?|liberation serif)$/, 'Tinos'],
  [/^(georgia)$/, 'Gelasio'],
  [/^(courier( new)?|liberation mono)$/, 'Cousine'],
  [/^(menlo|monaco|consolas|sfmono-regular|sf mono|ui-monospace|monospace|lucida console)$/, 'JetBrains Mono'],
  [/^(serif|ui-serif)$/, 'Tinos'],
  [/^(sans-serif)$/, 'Inter']
];

function stackFamily(stack: string): string {
  for (const raw of stack.split(',')) {
    const name = raw.replace(/["']/g, '').trim();
    const standIn = STAND_INS.find(([re]) => re.test(name.toLowerCase()))?.[1];
    const found = standIn ?? catalogueFamily(name, FAMILIES);
    if (found) {
      return found;
    }
  }
  return familyFor(stack, FAMILIES);
}

const uploadName = (family: string) => family.replace(UNSAFE_FAMILY, ' ').replace(/\s+/g, ' ').replace(/^[^A-Za-z0-9]+/, '').trim().slice(0, MAX_FAMILY) || 'Page Font';

function uploadsOf(tree: PageTree, assets: FontAssets): { uploads: FontUpload[]; names: Map<string, string> } {
  const byFamily = new Map<string, { family: string; variants: FontVariant[] }>();
  for (const use of usesOf(tree.root).filter(embeddable(tree.fonts ?? []))) {
    const face = faceFor(use, tree.fonts ?? []);
    const assetId = face ? assets[face.url] : undefined;
    if (!assetId) {
      continue;
    }
    const key = familyKey(use.family);
    const entry = byFamily.get(key) ?? { family: uploadName(use.family), variants: [] };
    if (!entry.variants.some((v) => v.weight === use.weight && v.italic === use.italic) && entry.variants.length < MAX_VARIANTS) {
      entry.variants.push({ assetId, weight: use.weight, italic: use.italic });
    }
    byFamily.set(key, entry);
  }
  return { uploads: [...byFamily.values()], names: new Map([...byFamily].map(([key, entry]) => [key, entry.family])) };
}

function mapped(n: RestNode, keyOf: Map<string, string>, family: (raw: string) => string): RestNode {
  const fills = n.fills?.flatMap((p): RestPaint[] => (p.imageRef ? (keyOf.has(p.imageRef) ? [{ ...p, imageRef: keyOf.get(p.imageRef) }] : []) : [p]));
  const styled = (style: RestStyle | undefined) => (style?.fontFamily ? { ...style, fontFamily: family(style.fontFamily) } : style);
  const table = n.styleOverrideTable ? Object.fromEntries(Object.entries(n.styleOverrideTable).map(([id, style]) => [id, styled(style)!])) : undefined;
  return { ...n, fills, style: styled(n.style), ...(table ? { styleOverrideTable: table } : {}), children: n.children?.map((c) => mapped(c, keyOf, family)) };
}

function countOf(doc: MotionDoc): ComponentCount {
  const mains = new Set(Object.entries(doc.comps).flatMap(([id, c]) => (c.component ? [id] : [])));
  const clips = [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips);
  const uses = clips.filter((c) => mains.has(String(c.props.comp))).length;
  return { components: mains.size, instances: uses - mains.size };
}

const SLICE = DESIGN_MAX_SIDE;

function lifted(n: RestNode, by: number): RestNode {
  const b = n.absoluteBoundingBox!;
  return { ...n, absoluteBoundingBox: { ...b, y: b.y - by }, ...(n.children ? { children: n.children.map((c) => lifted(c, by)) } : {}) };
}

function slicesOf(root: RestNode): { root: RestNode; top: number }[] {
  const page = root.absoluteBoundingBox!;
  return Array.from({ length: Math.max(1, Math.ceil(page.height / SLICE)) }, (_, i) => {
    const [top, bottom] = [i * SLICE, Math.min(page.height, (i + 1) * SLICE)];
    const part = windowed(root, { left: 0, top, right: page.width, bottom })!;
    return { root: lifted({ ...part, name: i ? `${root.name} ${i + 1}` : root.name, absoluteBoundingBox: { ...page, y: top, height: bottom - top } }, top), top };
  });
}

function stacked(slices: { root: RestNode; top: number }[], newId: () => string, uploads: FontUpload[]): FigmaPlan | null {
  const total = slices.reduce((s, x) => s + x.root.absoluteBoundingBox!.height, 0);
  const plans = slices.flatMap(({ root, top }) => {
    const plan = planOf(restMessage([root], FILE_KEY), newId, uploads);
    const middle = top + root.absoluteBoundingBox!.height / 2 - total / 2;
    return plan ? [{ ...plan, items: plan.items.map((item) => ({ ...item, centre: { x: 0, y: middle } })) }] : [];
  });
  return plans.length ? { items: plans.flatMap((p) => p.items), skipped: [...new Set(plans.flatMap((p) => p.skipped))], fileKey: plans[0].fileKey } : null;
}

export type Marker = (root: RestNode) => RestNode;

export enum Sectioning {
  On = 'on',
  Off = 'off'
}

export const sectioningOf = (sections: boolean) => (sections ? Sectioning.On : Sectioning.Off);

export type PageShape = { sectioning: Sectioning };

export const PLAIN_SHAPE: PageShape = { sectioning: Sectioning.Off };

export const FULL_SHAPE: PageShape = { sectioning: Sectioning.On };

const SECTIONED: Record<Sectioning, (tree: PageTree) => RestNode> = {
  [Sectioning.On]: (tree) => (tree.outline ? sectionFramed(tree.root, sectionsOf({ ...tree.outline, height: tree.height })) : tree.root),
  [Sectioning.Off]: (tree) => tree.root
};

const REPEATED: Marker = (root) => repeatedOf(root).root;

export function urlPlan(tree: PageTree, newId: () => string, mark: Marker = REPEATED, fonts: FontAssets = {}, shape: PageShape = PLAIN_SHAPE): UrlPlan | null {
  const name = (tree.title || new URL(tree.url).hostname).slice(0, MAX_NAME);
  const images = refsOf(tree.root);
  const keyOf = new Map(Object.entries(images).map(([key, url]) => [url, key]));
  const { uploads, names } = uploadsOf(tree, fonts);
  const family = (raw: string) => names.get(familyKey(raw)) ?? stackFamily(raw);
  const root = mapped({ ...mark(SECTIONED[shape.sectioning](tree)), name }, keyOf, family);
  const plan = stacked(slicesOf(root), newId, uploads);
  if (!plan) {
    return null;
  }
  const counts = plan.items.map((item) => countOf(item.doc));
  return { plan, images, name, components: { components: counts.reduce((s, c) => s + c.components, 0), instances: counts.reduce((s, c) => s + c.instances, 0) } };
}
