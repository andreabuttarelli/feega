import { builtinResolvers, makeFsImporter, parse, type Documentation } from 'react-docgen';
import { parseExpression } from '@babel/parser';
import { literalOf as nodeLiteralOf } from './ts-controls.ts';
import { TypeTag, controlOf, tagOfFallback, type PropControl, type PropType, type PropValue, type Scalar } from './prop-model.ts';

export { PropKind, type PropControl, type PropValue } from './prop-model.ts';

type PropDoc = NonNullable<Documentation['props']>[string];
type Shape = { name: string; raw?: string; value?: unknown; elements?: Shape[]; type?: string };

const NODE_TYPE = /ReactNode|ReactElement|JSX/;
const ARRAY_NAMES = new Set(['Array', 'ReadonlyArray', 'tuple']);
const OBJECT_NAMES = new Set(['object', 'Record', 'Partial', 'Required', 'Readonly', 'Pick', 'Omit', 'Map', 'Set']);
const NAMED_TYPE = /^[A-Z]/;
const FUNCTION_SIGNATURE = 'function';

const resolver = new builtinResolvers.FindExportedDefinitionsResolver({ limit: 0 });
const importer = makeFsImporter();

function literalOf(raw: string): PropValue | undefined {
  try {
    return nodeLiteralOf(parseExpression(raw));
  } catch {
    return undefined;
  }
}

const tagged = (tag: TypeTag): (() => PropType) => () => ({ tag });

function literalType(shape: Shape): PropType {
  const literal = literalOf(String(shape.value));
  return typeof literal === 'object' || literal === undefined ? { tag: TypeTag.Unknown } : { tag: TypeTag.Literal, literal };
}

const TS_TYPES: Record<string, (shape: Shape) => PropType> = {
  string: tagged(TypeTag.String),
  number: tagged(TypeTag.Number),
  boolean: tagged(TypeTag.Boolean),
  null: tagged(TypeTag.Nullish),
  undefined: tagged(TypeTag.Nullish),
  literal: literalType,
  Date: tagged(TypeTag.Date),
  Function: tagged(TypeTag.Function),
  signature: (shape) => ({ tag: shape.type === FUNCTION_SIGNATURE ? TypeTag.Function : TypeTag.Object }),
  union: (shape) => ({ tag: TypeTag.Union, members: (shape.elements ?? []).map(typeOfTs) })
};

function typeOfTs(shape: Shape): PropType {
  if (NODE_TYPE.test(shape.raw ?? shape.name)) {
    return { tag: TypeTag.Node };
  }
  if (ARRAY_NAMES.has(shape.name)) {
    return { tag: TypeTag.Array };
  }
  const named = OBJECT_NAMES.has(shape.name) || (!(shape.name in TS_TYPES) && NAMED_TYPE.test(shape.name));
  return (named ? tagged(TypeTag.Object) : (TS_TYPES[shape.name] ?? tagged(TypeTag.Unknown)))(shape);
}

function enumType(shape: Shape): PropType {
  const options = (shape.value as { value: string }[]).map((entry) => literalOf(entry.value));
  return options.every((option) => typeof option !== 'object' && option !== undefined) ? { tag: TypeTag.Union, members: options.map((literal) => ({ tag: TypeTag.Literal, literal: literal as Scalar })) } : { tag: TypeTag.Unknown };
}

const PROP_TYPES: Record<string, (shape: Shape) => PropType> = {
  bool: tagged(TypeTag.Boolean),
  string: tagged(TypeTag.String),
  number: tagged(TypeTag.Number),
  node: tagged(TypeTag.Node),
  element: tagged(TypeTag.Node),
  func: tagged(TypeTag.Function),
  array: tagged(TypeTag.Array),
  arrayOf: tagged(TypeTag.Array),
  object: tagged(TypeTag.Object),
  objectOf: tagged(TypeTag.Object),
  shape: tagged(TypeTag.Object),
  exact: tagged(TypeTag.Object),
  instanceOf: (shape) => ({ tag: shape.value === 'Date' ? TypeTag.Date : TypeTag.Object }),
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

const controlsOfDoc = (doc: Documentation): PropControl[] => Object.entries(doc.props ?? {}).flatMap(([prop, propDoc]) => controlOfDoc(prop, propDoc) ?? []);

const isDefaultExport = (doc: Documentation) => (doc as { exportName?: string }).exportName === 'default';

export function controlsOf(code: string, filename: string, name: string): PropControl[] | null {
  const docs = documentsOf(code, filename);
  const doc = docs?.find((d) => d.displayName === name) ?? docs?.find(isDefaultExport) ?? (docs?.length === 1 ? docs[0] : undefined);
  return doc ? controlsOfDoc(doc) : null;
}

export const DEFAULT_ENTRY = 'default';

export function controlsByName(code: string, filename: string): Record<string, PropControl[]> | null {
  const docs = documentsOf(code, filename);
  if (!docs?.length) {
    return null;
  }
  const named = docs.flatMap((doc) => (doc.displayName ? [[doc.displayName, controlsOfDoc(doc)] as const] : []));
  const fallback = docs.find(isDefaultExport) ?? (docs.length === 1 ? docs[0] : undefined);
  return Object.fromEntries([...named, ...(fallback ? [[DEFAULT_ENTRY, controlsOfDoc(fallback)] as const] : [])]);
}
