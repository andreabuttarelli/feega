export enum PropKind {
  Select = 'select',
  Toggle = 'toggle',
  Text = 'text',
  Number = 'number',
  Children = 'children',
  Array = 'array',
  Object = 'object',
  Callback = 'callback',
  Color = 'color',
  Date = 'date'
}

export type Scalar = string | number | boolean;

export type PropValue = Scalar | null | PropValue[] | { [key: string]: PropValue };

export type PropControl = { name: string; kind: PropKind; required: boolean; options?: Scalar[]; default?: PropValue };

export enum TypeTag {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Literal = 'literal',
  Union = 'union',
  Node = 'node',
  Nullish = 'nullish',
  Unknown = 'unknown',
  Function = 'function',
  Array = 'array',
  Object = 'object',
  Date = 'date'
}

export type PropType = { tag: TypeTag; members?: PropType[]; literal?: Scalar };

export type PropMember = { name: string; optional: boolean; type: PropType | null; fallback?: PropValue };

type Typed = { kind: PropKind; options?: Scalar[] };

const CHILDREN = 'children';
const COLOR_NAME = /colou?r$|^(bg|fill|stroke|background)(color)?$/i;
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgb|hsl|oklch|lab)a?\(.*\))$/i;
const FUNCTION_MARK = { $fn: true };

export const NOOP: PropValue = FUNCTION_MARK;
export const isNoop = (value: unknown): boolean => typeof value === 'object' && value !== null && (value as { $fn?: unknown }).$fn === true;

const TAG_OF_FALLBACK: Record<string, (value: PropValue) => TypeTag> = {
  string: () => TypeTag.String,
  number: () => TypeTag.Number,
  boolean: () => TypeTag.Boolean,
  object: (value) => (Array.isArray(value) ? TypeTag.Array : isNoop(value) ? TypeTag.Function : TypeTag.Object)
};

export const tagOfFallback = (fallback: PropValue | undefined): TypeTag => (fallback === undefined || fallback === null ? TypeTag.String : TAG_OF_FALLBACK[typeof fallback](fallback));

const PRIORITY: TypeTag[] = [TypeTag.Node, TypeTag.Array, TypeTag.Object, TypeTag.Date, TypeTag.String, TypeTag.Number, TypeTag.Boolean, TypeTag.Function];

function selectOf(members: PropType[]): Typed | null {
  const options = members.map((member) => (member.tag === TypeTag.Literal ? member.literal : undefined));
  return options.length > 0 && options.every((option) => option !== undefined) ? { kind: PropKind.Select, options: options as Scalar[] } : null;
}

function unionKind(type: PropType): Typed | null {
  const members = (type.members ?? []).filter((member) => member.tag !== TypeTag.Nullish);
  const winner = PRIORITY.map((tag) => members.find((member) => member.tag === tag)).find(Boolean);
  return selectOf(members) ?? (winner ? typedOf(winner) : null);
}

const kind = (value: PropKind) => (): Typed => ({ kind: value });
const none = (): null => null;

const KIND_OF: Record<TypeTag, (type: PropType) => Typed | null> = {
  [TypeTag.String]: kind(PropKind.Text),
  [TypeTag.Number]: kind(PropKind.Number),
  [TypeTag.Boolean]: kind(PropKind.Toggle),
  [TypeTag.Node]: kind(PropKind.Children),
  [TypeTag.Function]: kind(PropKind.Callback),
  [TypeTag.Array]: kind(PropKind.Array),
  [TypeTag.Object]: kind(PropKind.Object),
  [TypeTag.Date]: kind(PropKind.Date),
  [TypeTag.Union]: unionKind,
  [TypeTag.Literal]: none,
  [TypeTag.Nullish]: none,
  [TypeTag.Unknown]: none
};

export const typedOf = (type: PropType): Typed | null => KIND_OF[type.tag](type);

const isColor = (name: string, fallback: PropValue | undefined) => COLOR_NAME.test(name) || (typeof fallback === 'string' && COLOR_VALUE.test(fallback));

const REFINE: Partial<Record<PropKind, (name: string, fallback: PropValue | undefined) => PropKind>> = {
  [PropKind.Text]: (name, fallback) => (isColor(name, fallback) ? PropKind.Color : PropKind.Text)
};

const refined = (typed: Typed, name: string, fallback: PropValue | undefined): Typed => ({ ...typed, kind: REFINE[typed.kind]?.(name, fallback) ?? typed.kind });

export function controlOf({ name, optional, type, fallback }: PropMember): PropControl | null {
  const resolved: PropType = type ?? { tag: name === CHILDREN ? TypeTag.Node : tagOfFallback(fallback) };
  const found = name === CHILDREN ? { kind: PropKind.Children } : typedOf(resolved);
  if (!found) {
    return null;
  }
  const typed = refined(found, name, fallback);
  const shown = typed.kind === PropKind.Callback ? undefined : fallback;
  return { name, kind: typed.kind, required: !optional && fallback === undefined, ...(typed.options && { options: typed.options }), ...(shown !== undefined && { default: shown }) };
}

export function constructorTag(name: string): TypeTag {
  return CONSTRUCTOR_TAGS[name] ?? TypeTag.Unknown;
}

const CONSTRUCTOR_TAGS: Record<string, TypeTag> = {
  String: TypeTag.String,
  Number: TypeTag.Number,
  Boolean: TypeTag.Boolean,
  Array: TypeTag.Array,
  Object: TypeTag.Object,
  Function: TypeTag.Function,
  Date: TypeTag.Date
};
