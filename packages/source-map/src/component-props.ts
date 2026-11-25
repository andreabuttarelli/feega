import { builtinResolvers, makeFsImporter, parse, type Documentation } from 'react-docgen';
import { TypeTag, controlOf, tagOfFallback, type PropControl, type PropType, type PropValue } from './prop-model.ts';

export { PropKind, type PropControl, type PropValue } from './prop-model.ts';

type PropDoc = NonNullable<Documentation['props']>[string];
type Shape = { name: string; raw?: string; value?: unknown; elements?: Shape[]; type?: string };

const NODE_TYPE = /ReactNode|ReactElement|JSX/;
const QUOTED = /^(['"`])(.*)\1$/s;
const NUMERIC = /^-?\d+(\.\d+)?$/;

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

const tagged = (tag: TypeTag): (() => PropType) => () => ({ tag });

function literalType(shape: Shape): PropType {
  const literal = literalOf(String(shape.value));
  return literal === undefined ? { tag: TypeTag.Unknown } : { tag: TypeTag.Literal, literal };
}

const TS_TYPES: Record<string, (shape: Shape) => PropType> = {
  string: tagged(TypeTag.String),
  number: tagged(TypeTag.Number),
  boolean: tagged(TypeTag.Boolean),
  null: tagged(TypeTag.Nullish),
  undefined: tagged(TypeTag.Nullish),
  literal: literalType,
  union: (shape) => ({ tag: TypeTag.Union, members: (shape.elements ?? []).map(typeOfTs) })
};

function typeOfTs(shape: Shape): PropType {
  if (NODE_TYPE.test(shape.raw ?? shape.name)) {
    return { tag: TypeTag.Node };
  }
  return (TS_TYPES[shape.name] ?? tagged(TypeTag.Unknown))(shape);
}

function enumType(shape: Shape): PropType {
  const options = (shape.value as { value: string }[]).map((entry) => literalOf(entry.value));
  return options.every((option) => option !== undefined) ? { tag: TypeTag.Union, members: options.map((literal) => ({ tag: TypeTag.Literal, literal })) } : { tag: TypeTag.Unknown };
}

const PROP_TYPES: Record<string, (shape: Shape) => PropType> = {
  bool: tagged(TypeTag.Boolean),
  string: tagged(TypeTag.String),
  number: tagged(TypeTag.Number),
  node: tagged(TypeTag.Node),
  element: tagged(TypeTag.Node),
  enum: (shape) => (Array.isArray(shape.value) ? enumType(shape) : { tag: TypeTag.Unknown })
};

const typeOfPropType = (shape: Shape): PropType => (PROP_TYPES[shape.name] ?? tagged(TypeTag.Unknown))(shape);

function typeOfDoc(doc: PropDoc, fallback: PropValue | undefined): PropType | null {
  if (doc.tsType) {
    return typeOfTs(doc.tsType as Shape);
  }
  return doc.type ? typeOfPropType(doc.type as Shape) : fallback === undefined ? null : { tag: tagOfFallback(fallback) };
}

function controlOfDoc(name: string, doc: PropDoc): PropControl | null {
  const fallback = doc.defaultValue ? literalOf(String(doc.defaultValue.value)) : undefined;
  return controlOf({ name, optional: !doc.required, type: typeOfDoc(doc, fallback), fallback });
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
  return Object.entries(doc.props ?? {}).flatMap(([prop, propDoc]) => controlOfDoc(prop, propDoc) ?? []);
}
