import { builtinResolvers, makeFsImporter, parse, type Documentation } from 'react-docgen';

export enum PropKind {
  Select = 'select',
  Toggle = 'toggle',
  Text = 'text',
  Number = 'number',
  Children = 'children'
}

export type PropValue = string | number | boolean;

export type PropControl = { name: string; kind: PropKind; required: boolean; options?: string[]; default?: PropValue };

type PropDoc = NonNullable<Documentation['props']>[string];

const CHILDREN = 'children';
const NODE_TYPE = /ReactNode|ReactElement|JSX/;
const QUOTED = /^(['"`])(.*)\1$/s;
const NUMERIC = /^-?\d+(\.\d+)?$/;
const IGNORED_MEMBERS = new Set(['undefined', 'null']);

const resolver = new builtinResolvers.FindExportedDefinitionsResolver({ limit: 0 });
const importer = makeFsImporter();

const unquote = (raw: string) => QUOTED.exec(raw)?.[2] ?? raw;

function literalOf(raw: string): PropValue | undefined {
  if (raw === 'true' || raw === 'false') {
    return raw === 'true';
  }
  if (NUMERIC.test(raw)) {
    return Number(raw);
  }
  return QUOTED.test(raw) ? unquote(raw) : undefined;
}

type Shape = { name: string; raw?: string; value?: unknown; elements?: Shape[] };

const optionsOf = (members: Shape[]): string[] | null => {
  const options = members.filter((m) => !IGNORED_MEMBERS.has(m.name));
  const values = options.map((m) => (m.name === 'literal' ? literalOf(String(m.value)) : undefined));
  return values.length > 0 && values.every((v) => typeof v === 'string') ? (values as string[]) : null;
};

function kindOfTs(name: string, ts: Shape): { kind: PropKind; options?: string[] } | null {
  if (name === CHILDREN || NODE_TYPE.test(ts.raw ?? ts.name)) {
    return { kind: PropKind.Children };
  }
  if (ts.name === 'union') {
    const options = optionsOf(ts.elements ?? []);
    const members = (ts.elements ?? []).filter((m) => !IGNORED_MEMBERS.has(m.name));
    if (options) {
      return { kind: PropKind.Select, options };
    }
    return members.length === 1 ? kindOfTs(name, members[0]) : null;
  }
  const simple: Record<string, PropKind> = { boolean: PropKind.Toggle, string: PropKind.Text, number: PropKind.Number };
  return simple[ts.name] ? { kind: simple[ts.name] } : null;
}

function kindOfPropType(name: string, type: Shape): { kind: PropKind; options?: string[] } | null {
  if (name === CHILDREN || type.name === 'node' || type.name === 'element') {
    return { kind: PropKind.Children };
  }
  if (type.name === 'enum' && Array.isArray(type.value)) {
    const options = (type.value as { value: string }[]).map((v) => literalOf(v.value));
    return options.every((v) => typeof v === 'string') ? { kind: PropKind.Select, options: options as string[] } : null;
  }
  const simple: Record<string, PropKind> = { bool: PropKind.Toggle, string: PropKind.Text, number: PropKind.Number };
  return simple[type.name] ? { kind: simple[type.name] } : null;
}

function kindOfDefault(name: string, fallback: PropValue | undefined): { kind: PropKind } | null {
  if (name === CHILDREN) {
    return { kind: PropKind.Children };
  }
  const byType: Record<string, PropKind> = { boolean: PropKind.Toggle, string: PropKind.Text, number: PropKind.Number };
  return fallback === undefined ? { kind: PropKind.Text } : { kind: byType[typeof fallback] };
}

function controlOf(name: string, doc: PropDoc): PropControl | null {
  const fallback = doc.defaultValue ? literalOf(String(doc.defaultValue.value)) : undefined;
  const typed = doc.tsType ? kindOfTs(name, doc.tsType as Shape) : doc.type ? kindOfPropType(name, doc.type as Shape) : kindOfDefault(name, fallback);
  if (!typed) {
    return null;
  }
  return { name, kind: typed.kind, required: Boolean(doc.required), ...(typed.options && { options: typed.options }), ...(fallback !== undefined && { default: fallback }) };
}

function documentsOf(code: string, filename: string): Documentation[] | null {
  try {
    return parse(code, { filename, resolver, importer, babelOptions: { babelrc: false, configFile: false } }) as Documentation[];
  } catch {
    return null;
  }
}

export function controlsOf(code: string, filename: string, name: string): PropControl[] | null {
  const docs = documentsOf(code, filename);
  const doc = docs?.find((d) => d.displayName === name) ?? docs?.find((d) => d.exportName === 'default') ?? (docs?.length === 1 ? docs[0] : undefined);
  if (!doc) {
    return null;
  }
  return Object.entries(doc.props ?? {}).flatMap(([prop, propDoc]) => controlOf(prop, propDoc) ?? []);
}
