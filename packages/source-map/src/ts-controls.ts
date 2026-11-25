import { NOOP, TypeTag, controlOf, type PropControl, type PropMember, type PropType, type PropValue, type Scalar } from './prop-model.ts';

export type TsNode = { type: string; [key: string]: any };

export type TsMember = { name: string; optional: boolean; type: TsNode | null };

const MAX_DEPTH = 8;
const NAMED_TYPE = /^[A-Z]/;
const NODE_NAME = /Snippet|Slot|ReactNode|ReactElement|JSX|VNode/;
const ARRAY_NAMES = new Set(['Array', 'ReadonlyArray']);
const OBJECT_NAMES = new Set(['Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Map', 'Set']);
const FUNCTION_NAMES = new Set(['Function']);
const PROPERTY_TYPES = new Set(['Property', 'ObjectProperty']);
const DATE_NAMES = new Set(['Date']);

const SCALARS = ['string', 'number', 'boolean'];

const VALUE_OF_NODE: Record<string, (node: TsNode) => PropValue | undefined> = {
  UnaryExpression: (node) => (node.operator === '-' && typeof node.argument?.value === 'number' ? -node.argument.value : undefined),
  TemplateLiteral: (node) => (node.expressions.length === 0 ? node.quasis[0].value.cooked : undefined),
  ArrayExpression: (node) => {
    const items = (node.elements as TsNode[]).map((element) => literalOf(element));
    return items.every((item) => item !== undefined) ? (items as PropValue[]) : undefined;
  },
  ObjectExpression: (node) => {
    const entries = (node.properties as TsNode[]).map((property) => [property.key?.name ?? property.key?.value, PROPERTY_TYPES.has(property.type) ? literalOf(property.value) : undefined] as const);
    return entries.every(([key, value]) => key !== undefined && value !== undefined) ? Object.fromEntries(entries as [string, PropValue][]) : undefined;
  },
  ArrowFunctionExpression: () => NOOP,
  FunctionExpression: () => NOOP
};

export function literalOf(node: TsNode | null | undefined): PropValue | undefined {
  if (!node) {
    return undefined;
  }
  const read = VALUE_OF_NODE[node.type];
  if (read) {
    return read(node);
  }
  return SCALARS.includes(typeof node.value) ? node.value : undefined;
}

export function factoryValueOf(node: TsNode | null | undefined): PropValue | undefined {
  const isFactory = node?.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement';
  return isFactory ? literalOf(node.body) : literalOf(node);
}

export type Scope = { declared: Map<string, TsNode>; depth: number };

const tagged = (tag: TypeTag): (() => PropType) => () => ({ tag });

function literalType(node: TsNode): PropType {
  const literal = literalOf(node.literal);
  return typeof literal === 'object' || literal === undefined ? { tag: TypeTag.Unknown } : { tag: TypeTag.Literal, literal: literal as Scalar };
}

function referenceType(node: TsNode, scope: Scope): PropType {
  const name: string = node.typeName?.name ?? '';
  if (NODE_NAME.test(name)) {
    return { tag: TypeTag.Node };
  }
  const byName = [
    [ARRAY_NAMES, TypeTag.Array],
    [OBJECT_NAMES, TypeTag.Object],
    [FUNCTION_NAMES, TypeTag.Function],
    [DATE_NAMES, TypeTag.Date]
  ] as const;
  const known = byName.find(([names]) => names.has(name));
  if (known) {
    return { tag: known[1] };
  }
  const declaration = scope.declared.get(name);
  if (!declaration) {
    return { tag: NAMED_TYPE.test(name) ? TypeTag.Object : TypeTag.Unknown };
  }
  if (scope.depth >= MAX_DEPTH) {
    return { tag: TypeTag.Unknown };
  }
  return declaration.type === 'TSInterfaceDeclaration' ? { tag: TypeTag.Object } : typeOf(declaration, { ...scope, depth: scope.depth + 1 });
}

const TYPE_OF_NODE: Record<string, (node: TsNode, scope: Scope) => PropType> = {
  TSStringKeyword: tagged(TypeTag.String),
  TSNumberKeyword: tagged(TypeTag.Number),
  TSBooleanKeyword: tagged(TypeTag.Boolean),
  TSNullKeyword: tagged(TypeTag.Nullish),
  TSUndefinedKeyword: tagged(TypeTag.Nullish),
  TSAnyKeyword: tagged(TypeTag.Unknown),
  TSUnknownKeyword: tagged(TypeTag.Unknown),
  TSObjectKeyword: tagged(TypeTag.Object),
  TSTypeLiteral: tagged(TypeTag.Object),
  TSMappedType: tagged(TypeTag.Object),
  TSArrayType: tagged(TypeTag.Array),
  TSTupleType: tagged(TypeTag.Array),
  TSFunctionType: tagged(TypeTag.Function),
  TSLiteralType: literalType,
  TSUnionType: (node, scope) => ({ tag: TypeTag.Union, members: (node.types as TsNode[]).map((member) => typeOf(member, scope)) }),
  TSTypeReference: referenceType
};

export function typeOf(node: TsNode, scope: Scope): PropType {
  return (TYPE_OF_NODE[node.type] ?? tagged(TypeTag.Unknown))(node, scope);
}

const keyOf = (key: TsNode) => key.name ?? key.value;

export function membersOf(type: TsNode | null | undefined, declared: Map<string, TsNode>): TsMember[] {
  if (!type) {
    return [];
  }
  if (type.type === 'TSTypeReference') {
    return membersOf(declared.get(type.typeName?.name), declared);
  }
  if (type.type === 'TSIntersectionType') {
    return (type.types as TsNode[]).flatMap((part) => membersOf(part, declared));
  }
  const body = type.type === 'TSInterfaceDeclaration' ? type.body.body : type.type === 'TSTypeLiteral' ? type.members : null;
  if (!body) {
    return [];
  }
  return (body as TsNode[]).flatMap((member) => (member.type === 'TSPropertySignature' ? [{ name: keyOf(member.key), optional: Boolean(member.optional), type: member.typeAnnotation?.typeAnnotation ?? null }] : []));
}

export function declarationsOf(body: TsNode[]): Map<string, TsNode> {
  const declared = new Map<string, TsNode>();
  for (const statement of body) {
    const node = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (node?.type === 'TSInterfaceDeclaration') {
      declared.set(node.id.name, node);
    }
    if (node?.type === 'TSTypeAliasDeclaration') {
      declared.set(node.id.name, node.typeAnnotation);
    }
  }
  return declared;
}

export function controlsOfMembers(members: TsMember[], defaults: Map<string, PropValue>, declared: Map<string, TsNode>): PropControl[] {
  const scope = { declared, depth: 0 };
  return members.flatMap((member) => {
    const propMember: PropMember = { name: member.name, optional: member.optional, type: member.type && typeOf(member.type, scope), fallback: defaults.get(member.name) };
    return controlOf(propMember) ?? [];
  });
}

export type Destructured = { name: string; fallback: PropValue | undefined };

export function destructuredOf(pattern: TsNode): Destructured[] {
  return (pattern.properties as TsNode[]).flatMap((property) => {
    if (!PROPERTY_TYPES.has(property.type) || !property.key?.name) {
      return [];
    }
    const withDefault = property.value.type === 'AssignmentPattern';
    return [{ name: property.key.name, fallback: withDefault ? literalOf(property.value.right) : undefined }];
  });
}

export function controlsOfPattern(names: Destructured[] | null, typeNode: TsNode | null | undefined, declared: Map<string, TsNode>): PropControl[] {
  const typed = membersOf(typeNode, declared);
  const byName = new Map(typed.map((member) => [member.name, member]));
  const members: TsMember[] = names ? names.map(({ name }) => byName.get(name) ?? { name, optional: false, type: null }) : typed;
  const defaults = new Map((names ?? []).flatMap(({ name, fallback }) => (fallback === undefined ? [] : [[name, fallback] as [string, PropValue]])));
  return controlsOfMembers(members, defaults, declared);
}
