import { DEFAULT_VARIANT } from '@feega/motion-core/motion/doc';
import type { CodeComponent } from '$lib/canvas/figma/archive';
import type { RestNode } from '$lib/server/figma/rest-message';
import type { ComponentUse, PropValue } from './component-marks';

const MAX_AXIS_VALUES = 8;
const MAX_VARIANTS = 64;
const MAX_KEY = 40;
const SYMBOL = /^[a-z][\w-]{0,23}$/;
const ALWAYS_TEXT = 'children';
const IGNORED = /^(className|style|id|key|ref|href|src|alt|type|asChild|value|defaultValue|name|role|tabIndex|htmlFor|on[A-Z].*|aria-.*|data-.*)$/;

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

export function withComponents(node: RestNode, refs: readonly (CodeComponent | null)[]): RestNode {
  const { use, ...rest } = node;
  const ref = use === undefined ? null : (refs[use] ?? null);
  return { ...rest, ...(ref ? { codeComponent: ref } : {}), ...(node.children ? { children: node.children.map((c) => withComponents(c, refs)) } : {}) };
}
