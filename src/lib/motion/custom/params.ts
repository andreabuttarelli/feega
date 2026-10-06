import { modifierProps } from '../shape/model';
import type { Modifier } from '../shape/schema';
import { parse, type Node } from 'acorn';
import { full } from 'acorn-walk';
import { FONTS } from '../components';
import { Source, ValueKind, type AnimProp } from '../keyframes';
import type { MotionClip, MotionDoc } from '../doc';
import { PropFormat, type PropSpec } from './component';
import { effectProps, type Effect } from '../effects/model';
import { animatorProps, type TextAnimator } from '../text-animators/model';
import { textPathProps, type TextPath } from '../text-path/model';

export const PARAM_CALL = 'param';
export const PARAM_CSS_PREFIX = '--param-';

export const PARAM_EASES = ['none', 'power1.out', 'power2.out', 'power3.out', 'power2.in', 'power2.inOut', 'back.out(1.7)', 'elastic.out(1,0.4)', 'expo.out', 'sine.inOut'] as const;

const UNBOUNDED = 1_000_000;

const CLIP_OWNED: Record<string, string> = { name: 'the clip uses it to find its component' };

type Options = { type?: string; min?: number; max?: number; step?: number; options?: string[]; label?: string; group?: string; kind?: string };
type AnyNode = Node & Record<string, unknown>;

const spec = (base: Partial<PropSpec> & Pick<PropSpec, 'type'>, o: Options): PropSpec =>
  ({ ...base, ...(o.label ? { title: o.label } : {}), ...(o.group ? { group: o.group } : {}) }) as PropSpec;

const PARAM_TYPES: Record<string, (fallback: unknown, o: Options) => PropSpec> = {
  text: (d, o) => spec({ type: 'string', default: String(d ?? '') }, o),
  textarea: (d, o) => spec({ type: 'string', format: PropFormat.Textarea, default: String(d ?? '') }, o),
  number: (d, o) => spec({ type: 'number', default: Number(d ?? 0), minimum: o.min, maximum: o.max, step: o.step }, o),
  color: (d, o) => spec({ type: 'string', format: PropFormat.Color, default: String(d ?? 'brand.accent') }, o),
  boolean: (d, o) => spec({ type: 'boolean', default: Boolean(d) }, o),
  select: (d, o) => spec({ type: 'string', enum: o.options, default: String(d ?? o.options?.[0] ?? '') }, o),
  asset: (_, o) => spec({ type: 'string', format: PropFormat.Asset, assetKind: (o.kind ?? 'image') as PropSpec['assetKind'], default: null }, o),
  font: (d, o) => spec({ type: 'string', format: PropFormat.Font, default: String(d ?? FONTS[0]) }, o),
  ease: (d, o) => spec({ type: 'string', enum: [...PARAM_EASES], default: String(d ?? PARAM_EASES[2]) }, o)
};

const TYPE_OF_VALUE: Record<string, string> = { number: 'number', boolean: 'boolean', string: 'text' };

function literal(node: AnyNode | undefined): unknown {
  if (!node) {
    return undefined;
  }
  if (node.type === 'Literal') {
    return node.value;
  }
  if (node.type === 'UnaryExpression' && node.operator === '-' && (node.argument as AnyNode).type === 'Literal') {
    return -Number((node.argument as AnyNode).value);
  }
  if (node.type === 'ArrayExpression') {
    return (node.elements as AnyNode[]).map(literal);
  }
  if (node.type === 'ObjectExpression') {
    return Object.fromEntries((node.properties as AnyNode[]).map((p) => [String((p.key as AnyNode).name ?? (p.key as AnyNode).value), literal(p.value as AnyNode)]));
  }
  throw new Error('param() takes literal values only: param("name", default, { type, min, max, ... })');
}

export function extractParams(js: string): Record<string, PropSpec> {
  const program = parse(js, { ecmaVersion: 2022, sourceType: 'script', allowReturnOutsideFunction: true });
  const params: Record<string, PropSpec> = {};
  full(program, (node) => {
    const call = node as AnyNode;
    if (call.type !== 'CallExpression' || (call.callee as AnyNode).type !== 'Identifier' || (call.callee as AnyNode).name !== PARAM_CALL) {
      return;
    }
    const [nameNode, fallbackNode, optionsNode] = call.arguments as AnyNode[];
    const name = literal(nameNode);
    if (typeof name !== 'string') {
      throw new Error('param() needs a literal name as first argument');
    }
    if (name in CLIP_OWNED) {
      throw new Error(`param ${name}: reserved, ${CLIP_OWNED[name]}; pick another name`);
    }
    const fallback = literal(fallbackNode);
    const options = (literal(optionsNode) ?? {}) as Options;
    const type = options.type ?? TYPE_OF_VALUE[typeof fallback] ?? 'text';
    const make = PARAM_TYPES[type];
    if (!make) {
      throw new Error(`param ${name}: unknown type ${type}; use ${Object.keys(PARAM_TYPES).join(', ')}`);
    }
    params[name] = make(fallback, options);
  });
  return params;
}

const KEYFRAMEABLE: Record<string, (key: string, s: PropSpec) => AnimProp | null> = {
  number: (key, s) => ({ key, label: s.title ?? key, kind: ValueKind.Number, source: Source.Param, min: s.minimum ?? -UNBOUNDED, max: s.maximum ?? UNBOUNDED, step: s.step ?? 1, fallback: Number(s.default ?? 0) }),
  string: (key, s) => (s.format === PropFormat.Color ? { key, label: s.title ?? key, kind: ValueKind.Color, source: Source.Param, min: 0, max: 0, step: 0, fallback: 0 } : null),
  boolean: () => null
};

export function paramProps(doc: Pick<MotionDoc, 'components'>, clip: Pick<MotionClip, 'component' | 'props'>): AnimProp[] {
  const component = clip.component === 'Custom' ? doc.components[String(clip.props.name)] : undefined;
  if (!component) {
    return [];
  }
  return Object.entries(component.propsSchema.properties)
    .map(([key, s]) => KEYFRAMEABLE[s.type](key, s))
    .filter((p): p is AnimProp => p !== null);
}

function shapeModifierProps(clip: Pick<MotionClip, 'component' | 'props'>): AnimProp[] {
  return clip.component === 'Shape' ? modifierProps((clip.props.modifiers as Modifier[] | undefined) ?? []) : [];
}

export function withParams<C extends Pick<MotionClip, 'component' | 'props'> & { effects?: Effect[]; animators?: TextAnimator[]; textPath?: TextPath | null }>(doc: Pick<MotionDoc, 'components'>, clip: C): C & { params: AnimProp[] } {
  return { ...clip, params: [...paramProps(doc, clip), ...effectProps(clip.effects ?? []), ...animatorProps(clip.animators ?? []), ...shapeModifierProps(clip), ...textPathProps(clip.textPath ?? null)] };
}
