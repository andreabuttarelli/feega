export enum PropKind {
  Select = 'select',
  Toggle = 'toggle',
  Text = 'text',
  Number = 'number',
  Children = 'children'
}

export type PropValue = string | number | boolean;

export type PropControl = { name: string; kind: PropKind; required: boolean; options?: string[]; default?: PropValue };

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

export type PropType = { tag: TypeTag; members?: PropType[]; literal?: PropValue };

export type PropMember = { name: string; optional: boolean; type: PropType | null; fallback?: PropValue };

type Typed = { kind: PropKind; options?: string[] };

const CHILDREN = 'children';
const FALLBACK_TAGS: Record<string, TypeTag> = { string: TypeTag.String, number: TypeTag.Number, boolean: TypeTag.Boolean };

export const tagOfFallback = (fallback: PropValue | undefined): TypeTag => (fallback === undefined ? TypeTag.String : FALLBACK_TAGS[typeof fallback]);

function selectOf(members: PropType[]): Typed | null {
  const options = members.map((member) => (member.tag === TypeTag.Literal ? member.literal : undefined));
  return options.length > 0 && options.every((option) => typeof option === 'string') ? { kind: PropKind.Select, options: options as string[] } : null;
}

function unionKind(type: PropType): Typed | null {
  const members = (type.members ?? []).filter((member) => member.tag !== TypeTag.Nullish);
  return selectOf(members) ?? (members.length === 1 ? typedOf(members[0]) : null);
}

const KIND_OF: Record<TypeTag, (type: PropType) => Typed | null> = {
  [TypeTag.String]: () => ({ kind: PropKind.Text }),
  [TypeTag.Number]: () => ({ kind: PropKind.Number }),
  [TypeTag.Boolean]: () => ({ kind: PropKind.Toggle }),
  [TypeTag.Node]: () => ({ kind: PropKind.Children }),
  [TypeTag.Union]: unionKind,
  [TypeTag.Literal]: () => null,
  [TypeTag.Nullish]: () => null,
  [TypeTag.Unknown]: () => null,
  [TypeTag.Function]: () => null,
  [TypeTag.Array]: () => null,
  [TypeTag.Object]: () => null,
  [TypeTag.Date]: () => null
};

export const typedOf = (type: PropType): Typed | null => KIND_OF[type.tag](type);

export function controlOf({ name, optional, type, fallback }: PropMember): PropControl | null {
  const resolved: PropType = type ?? { tag: name === CHILDREN ? TypeTag.Node : tagOfFallback(fallback) };
  const typed = name === CHILDREN ? { kind: PropKind.Children } : typedOf(resolved);
  if (!typed) {
    return null;
  }
  return { name, kind: typed.kind, required: !optional && fallback === undefined, ...(typed.options && { options: typed.options }), ...(fallback !== undefined && { default: fallback }) };
}
