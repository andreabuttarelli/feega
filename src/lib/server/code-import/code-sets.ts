import { DEFAULT_VARIANT } from '@feega/motion-core/motion/doc';
import type { CodeComponent } from '$lib/canvas/figma/archive';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { ComponentUse, PropValue } from './component-marks';

const MAX_AXIS_VALUES = 8;
const MAX_VARIANTS = 64;
const MAX_KEY = 40;
const SYMBOL = /^[a-z][\w-]{0,23}$/;
const ALWAYS_TEXT = 'children';
const IGNORED = /^(className|style|id|key|ref|href|src|alt|type|asChild|value|defaultValue|name|role|tabIndex|htmlFor|on[A-Z].*|aria-.*|data-.*|\$\$.*|__.*)$/;

enum PropRole {
  Axis = 'axis',
  Text = 'text',
  Ignored = 'ignored'
}

const ROLE_OF_TYPE: Record<string, (values: PropValue[]) => PropRole> = {
  boolean: () => PropRole.Axis,
  number: () => PropRole.Ignored,
  string: (values) => (values.every((v) => SYMBOL.test(String(v))) && new Set(values).size <= MAX_AXIS_VALUES ? PropRole.Axis : PropRole.Text)
};

function rolesOf(uses: ComponentUse[]): Map<string, PropRole> {
  const keys = [...new Set(uses.flatMap((u) => Object.keys(u.props)))].filter((k) => k.length <= MAX_KEY);
  return new Map(
    keys.map((key) => {
      const values = uses.flatMap((u) => (key in u.props ? [u.props[key]] : []));
      const types = new Set(values.map((v) => typeof v));
      if (IGNORED.test(key) || types.size !== 1) {
        return [key, PropRole.Ignored];
      }
      return [key, key === ALWAYS_TEXT ? PropRole.Text : ROLE_OF_TYPE[[...types][0]](values)];
    })
  );
}

const sortedEntries = (record: Record<string, string>) => Object.entries(record).sort(([a], [b]) => a.localeCompare(b));

function refOf(use: ComponentUse, roles: Map<string, PropRole>): CodeComponent {
  const axes = [...roles].filter(([, role]) => role === PropRole.Axis).map(([k]) => k);
  const variant = Object.fromEntries(axes.map((k) => [k, k in use.props ? String(use.props[k]) : DEFAULT_VARIANT]));
  const texts = Object.fromEntries([...roles].filter(([k, role]) => role === PropRole.Text && typeof use.props[k] === 'string').map(([k]) => [k, String(use.props[k])]));
  return { key: `${use.component}|${JSON.stringify(sortedEntries(variant))}`, name: use.component, variant, texts };
}

export function codeSets(uses: ComponentUse[]): (CodeComponent | null)[] {
  const byName = Map.groupBy(uses, (u) => u.component);
  const roles = new Map([...byName].map(([name, own]) => [name, rolesOf(own)]));
  const keys = new Map<string, Set<string>>();
  return uses.map((use) => {
    const ref = refOf(use, roles.get(use.component)!);
    const seen = keys.get(use.component) ?? new Set<string>();
    if (!seen.has(ref.key) && seen.size >= MAX_VARIANTS) {
      return null;
    }
    keys.set(use.component, seen.add(ref.key));
    return ref;
  });
}

const CONTAINERS = new Set(['FRAME', 'GROUP']);
const MAX_CHAIN = 2;

export const innerOf = (uses: readonly ComponentUse[]): Map<number, number> => new Map(uses.flatMap((u, i) => (u.shares === undefined ? [] : [[u.shares, i] as [number, number]])));

function chainOf(use: number | undefined, refs: readonly (CodeComponent | null)[], inner: ReadonlyMap<number, number>): CodeComponent[] {
  const chain: CodeComponent[] = [];
  for (let at = use; at !== undefined; at = inner.get(at)) {
    const ref = refs[at];
    if (ref) {
      chain.push(ref);
    }
  }
  return chain.length > MAX_CHAIN ? [chain[0], chain.at(-1)!] : chain;
}

function wrapped(child: RestNode, ref: CodeComponent): RestNode {
  const { layoutGrow, layoutAlign, layoutPositioning, ...placed } = child;
  const item = { ...(layoutGrow === undefined ? {} : { layoutGrow }), ...(layoutAlign === undefined ? {} : { layoutAlign }), ...(layoutPositioning === undefined ? {} : { layoutPositioning }) };
  return { id: `${child.id}:${ref.name}`, type: 'FRAME', name: ref.name, absoluteBoundingBox: child.absoluteBoundingBox, fills: [], clipsContent: false, ...item, codeComponent: ref, children: [placed] };
}

export function withComponents(node: RestNode, refs: readonly (CodeComponent | null)[], inner: ReadonlyMap<number, number> = new Map()): RestNode {
  const { use, ...rest } = node;
  const chain = chainOf(use, refs, inner);
  const own = rest.children ? { ...rest, children: rest.children.map((c) => withComponents(c, refs, inner)) } : rest;
  const innermost = chain.at(-1);
  const leaf = innermost && CONTAINERS.has(own.type) ? { ...own, codeComponent: innermost } : innermost ? wrapped(own, innermost) : own;
  return chain.slice(0, -1).reduceRight((child, ref) => wrapped(child, ref), leaf);
}

const keysIn = (node: RestNode): string[] => (node.children ?? []).flatMap((c) => [...(c.codeComponent ? [c.codeComponent.key] : []), ...keysIn(c)]);

export function linkable(root: RestNode): RestNode {
  const seen = new Set<string>();
  const descend = (node: RestNode): RestNode => (node.children ? { ...node, children: node.children.map(visit) } : node);
  const visit = (node: RestNode): RestNode => {
    const key = node.codeComponent?.key;
    if (key === undefined) {
      return descend(node);
    }
    if (!seen.has(key)) {
      seen.add(key);
      return descend(node);
    }
    if (keysIn(node).every((k) => seen.has(k))) {
      return node;
    }
    return descend({ ...node, codeComponent: undefined });
  };
  return visit(root);
}
