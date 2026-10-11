import { z } from 'zod';

export enum VectorKind {
  Box = 'box',
  Text = 'text',
  Icon = 'icon',
  Image = 'image'
}

export enum VectorHint {
  Button = 'button',
  Input = 'input',
  Heading = 'heading',
  Link = 'link',
  Nav = 'nav',
  None = 'none'
}

export enum VectorRole {
  Button = 'button',
  Input = 'input',
  Heading = 'heading',
  Stat = 'stat',
  Link = 'link',
  Text = 'text',
  Icon = 'icon',
  Image = 'image',
  Card = 'card',
  Box = 'box'
}

const CSS_VALUE = z.string().max(400);
const MAX_TEXT = 300;
const MAX_SVG = 6_000;
export const MAX_NODES = 1_500;

export const RAW_NODE = z.object({
  kind: z.enum(VectorKind),
  hint: z.enum(VectorHint).default(VectorHint.None),
  x: z.number(),
  y: z.number(),
  w: z.number().nonnegative(),
  h: z.number().nonnegative(),
  o: z.number().min(0).max(1).optional(),
  fill: CSS_VALUE.optional(),
  stroke: CSS_VALUE.optional(),
  sides: z.array(z.string().max(80)).length(4).optional(),
  r: z.string().max(80).optional(),
  shadow: CSS_VALUE.optional(),
  blur: z.number().nonnegative().optional(),
  text: z.string().max(MAX_TEXT).optional(),
  color: CSS_VALUE.optional(),
  font: z.string().max(120).optional(),
  size: z.number().positive().optional(),
  weight: z.number().optional(),
  ls: z.number().optional(),
  lh: z.number().optional(),
  wrap: z.boolean().optional(),
  italic: z.boolean().optional(),
  svg: z.string().max(MAX_SVG).optional(),
  src: z.string().max(2_000).optional()
});

export const RAW_CAPTURE = z.object({
  url: z.string().max(2_000),
  title: z.string().max(300),
  width: z.number().positive(),
  height: z.number().positive(),
  background: CSS_VALUE,
  nodes: z.array(RAW_NODE).max(MAX_NODES * 2)
});

export type RawNode = z.infer<typeof RAW_NODE>;
export type RawCapture = z.infer<typeof RAW_CAPTURE>;

export type VectorNode = Omit<RawNode, 'hint' | 'src'> & { id: string; role: VectorRole };
export type VectorUi = { url: string; title: string; width: number; height: number; background: string; fonts: string[]; nodes: VectorNode[]; raster: string[] };

const STAT = /^[$€£¥+−-]?\s?\d[\d.,]*\s?(%|[kKmMbB]|x|×|\+)?$/;
const HEADING_SIZE = 30;
const CARD_MIN = 80;

const ROLE_OF_TEXT: Record<VectorHint, (n: RawNode) => VectorRole> = {
  [VectorHint.Button]: () => VectorRole.Button,
  [VectorHint.Input]: () => VectorRole.Input,
  [VectorHint.Heading]: () => VectorRole.Heading,
  [VectorHint.Link]: () => VectorRole.Link,
  [VectorHint.Nav]: () => VectorRole.Link,
  [VectorHint.None]: (n) => (STAT.test((n.text ?? '').trim()) ? VectorRole.Stat : (n.size ?? 0) >= HEADING_SIZE ? VectorRole.Heading : VectorRole.Text)
};

const ROLE_OF: Record<VectorKind, (n: RawNode) => VectorRole> = {
  [VectorKind.Text]: (n) => ROLE_OF_TEXT[n.hint](n),
  [VectorKind.Icon]: () => VectorRole.Icon,
  [VectorKind.Image]: () => VectorRole.Image,
  [VectorKind.Box]: (n) => (n.hint === VectorHint.Button ? VectorRole.Button : n.hint === VectorHint.Input ? VectorRole.Input : n.w >= CARD_MIN && n.h >= CARD_MIN && Boolean(n.r && n.r !== '0px') ? VectorRole.Card : VectorRole.Box)
};

export const roleOf = (n: RawNode): VectorRole => ROLE_OF[n.kind](n);

const inside = (n: RawNode, width: number, height: number) => n.w >= 1 && n.h >= 1 && n.x < width && n.y < height && n.x + n.w > 0 && n.y + n.h > 0;

const SAME_STYLE = ['font', 'size', 'weight', 'color', 'fill', 'o', 'hint', 'ls', 'italic'] as const;
const LINE_SLACK = 1.5;
const MAX_GAP = 0.6;
const SPACE_GAP = 0.15;

const sameStyle = (a: RawNode, b: RawNode) => SAME_STYLE.every((k) => a[k] === b[k]);

const gapOf = (a: RawNode, b: RawNode) => b.x - (a.x + a.w);

const joins = (a: RawNode, b: RawNode) => a.kind === VectorKind.Text && b.kind === VectorKind.Text && !a.wrap && !b.wrap && sameStyle(a, b) && Math.abs(a.y - b.y) <= LINE_SLACK && Math.abs(a.h - b.h) <= LINE_SLACK && gapOf(a, b) >= -LINE_SLACK && gapOf(a, b) <= (a.size ?? 16) * MAX_GAP;

export function mergeRuns(nodes: readonly RawNode[]): RawNode[] {
  const merged: RawNode[] = [];
  for (const node of nodes) {
    const last = merged.at(-1);
    if (!last || !joins(last, node)) {
      merged.push(node);
      continue;
    }
    const space = gapOf(last, node) > (last.size ?? 16) * SPACE_GAP ? ' ' : '';
    merged[merged.length - 1] = { ...last, w: Math.round((node.x + node.w - last.x) * 10) / 10, h: Math.max(last.h, node.h), text: `${last.text ?? ''}${space}${node.text ?? ''}` };
  }
  return merged;
}

export const minified = (svg: string) => svg.replace(/\s+/g, ' ').replace(/>\s+</g, '><').replace(/(\d+\.\d)\d+/g, '$1');

const firstFamily = (font: string) => font.split(',')[0].replace(/["']/g, '').trim();

export function vectorUi(capture: RawCapture): VectorUi {
  const counts = new Map<VectorRole, number>();
  const kept = mergeRuns(capture.nodes).filter((n) => inside(n, capture.width, capture.height)).slice(0, MAX_NODES);
  const nodes = kept.map(({ hint, src: _src, ...rest }) => {
    const role = roleOf({ hint, ...rest });
    const n = counts.get(role) ?? 0;
    counts.set(role, n + 1);
    return { ...rest, ...(rest.svg ? { svg: minified(rest.svg) } : {}), id: `${role}-${n}`, role };
  });
  const fonts = [...new Set(nodes.flatMap((n) => (n.font ? [firstFamily(n.font)] : [])))];
  return { url: capture.url, title: capture.title, width: capture.width, height: capture.height, background: capture.background, fonts, nodes, raster: nodes.filter((n) => n.kind === VectorKind.Image).map((n) => n.id) };
}

export const nodeOf = (ui: VectorUi, id: string) => ui.nodes.find((n) => n.id === id) ?? null;

export const ids = (ui: VectorUi, role: VectorRole) => ui.nodes.filter((n) => n.role === role).map((n) => n.id);

const DROP_ORDER: readonly VectorRole[] = [VectorRole.Icon, VectorRole.Image, VectorRole.Box, VectorRole.Card, VectorRole.Link, VectorRole.Text];

const area = (n: VectorNode) => n.w * n.h;

export function withinBudget(ui: VectorUi, chars: number, size: (ui: VectorUi) => number): VectorUi {
  let current = ui;
  for (const role of DROP_ORDER) {
    const droppable = current.nodes.filter((n) => n.role === role).sort((a, b) => area(a) - area(b));
    while (size(current) > chars && droppable.length) {
      const drop = new Set(droppable.splice(0, Math.max(1, Math.ceil(droppable.length / 8))).map((n) => n.id));
      current = { ...current, nodes: current.nodes.filter((n) => !drop.has(n.id)), raster: current.raster.filter((id) => !drop.has(id)) };
    }
    if (size(current) <= chars) {
      return current;
    }
  }
  return current;
}

export type Region = { x: number; y: number; w: number; h: number };

const overlaps = (n: VectorNode, r: Region) => n.x < r.x + r.w && n.y < r.y + r.h && n.x + n.w > r.x && n.y + n.h > r.y;

export function cropUi(ui: VectorUi, region: Region): VectorUi {
  const nodes = ui.nodes.filter((n) => overlaps(n, region)).map((n) => ({ ...n, x: n.x - region.x, y: n.y - region.y }));
  const kept = new Set(nodes.map((n) => n.id));
  return { ...ui, width: region.w, height: region.h, nodes, raster: ui.raster.filter((id) => kept.has(id)) };
}
