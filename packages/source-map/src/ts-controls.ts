import { PropKind, type PropControl, type PropValue } from './component-props.ts';

export type TsNode = { type: string; [key: string]: any };

export type PropMember = { name: string; optional: boolean; type: TsNode | null; fallback?: PropValue };

const CHILDREN = 'children';
const CHILDREN_TYPE = /Snippet|Slot/;
const IGNORED = new Set(['TSUndefinedKeyword', 'TSNullKeyword']);
const KEYWORDS: Record<string, PropKind> = { TSStringKeyword: PropKind.Text, TSNumberKeyword: PropKind.Number, TSBooleanKeyword: PropKind.Toggle };
const PRIMITIVE_KINDS: Record<string, PropKind> = { string: PropKind.Text, number: PropKind.Number, boolean: PropKind.Toggle };

export function literalOf(node: TsNode | null | undefined): PropValue | undefined {
  if (!node) {
    return undefined;
  }
  if (node.type === 'UnaryExpression' && node.operator === '-' && typeof node.argument?.value === 'number') {
    return -node.argument.value;
  }
  return ['string', 'number', 'boolean'].includes(typeof node.value) ? node.value : undefined;
}

function optionsOf(types: TsNode[]): string[] | null {
  const values = types.map((member) => (member.type === 'TSLiteralType' ? literalOf(member.literal) : undefined));
  return values.length > 0 && values.every((value) => typeof value === 'string') ? (values as string[]) : null;
}

function kindOfType(type: TsNode): { kind: PropKind; options?: string[] } | null {
  if (type.type === 'TSTypeReference' && CHILDREN_TYPE.test(type.typeName?.name ?? '')) {
    return { kind: PropKind.Children };
  }
  if (KEYWORDS[type.type]) {
    return { kind: KEYWORDS[type.type] };
  }
  if (type.type !== 'TSUnionType') {
    return null;
  }
  const members = (type.types as TsNode[]).filter((member) => !IGNORED.has(member.type));
  const options = optionsOf(members);
  if (options) {
    return { kind: PropKind.Select, options };
  }
  return members.length === 1 ? kindOfType(members[0]) : null;
}

export function controlOf({ name, optional, type, fallback }: PropMember): PropControl | null {
  const typed = type ? kindOfType(type) : { kind: name === CHILDREN ? PropKind.Children : fallback === undefined ? PropKind.Text : PRIMITIVE_KINDS[typeof fallback] };
  if (!typed) {
    return null;
  }
  return { name, kind: typed.kind, required: !optional && fallback === undefined, ...(typed.options && { options: typed.options }), ...(fallback !== undefined && { default: fallback }) };
}

const keyOf = (key: TsNode) => key.name ?? key.value;

export function membersOf(type: TsNode | null | undefined, declared: Map<string, TsNode>): { name: string; optional: boolean; type: TsNode | null }[] {
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

export function controlsOfMembers(members: { name: string; optional: boolean; type: TsNode | null }[], defaults: Map<string, PropValue>): PropControl[] {
  return members.flatMap((member) => controlOf({ ...member, fallback: defaults.get(member.name) }) ?? []);
}
