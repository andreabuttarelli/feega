import ts from 'typescript';
import { posix } from 'node:path';

export enum AxisSource {
  Cva = 'cva',
  Tv = 'tv',
  Union = 'union',
  Enum = 'enum',
  Boolean = 'boolean',
  Story = 'story'
}

export enum ExportKind {
  Named = 'named',
  Default = 'default'
}

export type Axis = { values: string[]; default: string | null; evidence: AxisSource[] };

export type DiscoveredComponent = { name: string; file: string; exported: ExportKind; axes: Record<string, Axis>; texts: string[]; states: string[]; unresolved: string[] };

export type Discovery = { components: DiscoveredComponent[] };

export type ReadMany = (paths: string[]) => Promise<Record<string, string>>;

export const LIBRARY_LIMITS = { files: 400, bytes: 200_000, cells: 64 };

const SHADCN_CONFIG = 'components.json';
const COMPONENT_DIR = /(^|\/)components\//;
const LIBRARY_FILE = /\.(tsx|jsx|ts|js|svelte|vue)$/;
const NOT_LIBRARY = /\.(test|spec)\.|\.d\.ts$|(^|\/)\+[^/]*$/;
const STORY_FILE = /\.stories\.(tsx|jsx|ts|js)$/;
const ALIAS_ROOTS: [RegExp, string][] = [
  [/^\$lib\//, 'src/lib/'],
  [/^[@~#]\//, '']
];
const IMPORT_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.svelte.ts', '/index.ts', '/index.tsx', '/index.js'];
const BOOLEAN_VALUES = ['false', 'true'];
const STATE_PROPS = new Set(['disabled', 'loading', 'open', 'checked', 'selected', 'active', 'pressed', 'expanded', 'invalid', 'busy']);
const NOT_TEXT = /^(class|className|style|id|key|ref|href|src|alt|on[A-Z].*|aria-.*|data-.*)$/;
const TEXT_TYPES = new Set(['Snippet', 'ReactNode', 'ReactElement', 'Element', 'VNode', 'JSXElement']);
const VARIANT_CALLS: Record<string, AxisSource> = { cva: AxisSource.Cva, tv: AxisSource.Tv };
const WRAPPERS = /(^|\.)(forwardRef|memo)$/;

enum Kind {
  Axis = 'axis',
  Boolean = 'boolean',
  Text = 'text',
  Ignored = 'ignored',
  Unresolved = 'unresolved'
}

type Shape = { kind: Kind.Axis; values: string[]; source: AxisSource; default?: string } | { kind: Exclude<Kind, Kind.Axis> };

type Prop = { name: string; shape: Shape };

type Variants = Map<string, Prop[]>;

type Scope = { file: string; types: Map<string, ts.Node>; enums: Map<string, string[]>; variants: Variants; imports: Map<string, { from: string; name: string }>; files: Map<string, Scope | null>; hop: boolean };

const IGNORED: Shape = { kind: Kind.Ignored };

function uiAlias(config: string | null): string | null {
  try {
    return config ? ((JSON.parse(config) as { aliases?: { ui?: string } }).aliases?.ui ?? null) : null;
  } catch {
    return null;
  }
}

function libraryDirs(config: string | null): string[] | null {
  const ui = uiAlias(config);
  if (!ui) {
    return null;
  }
  const [pattern, root] = ALIAS_ROOTS.find(([p]) => p.test(ui)) ?? [/^/, ''];
  const dir = `${root}${ui.replace(pattern, '')}/`;
  return [dir, `src/${dir}`];
}

export function libraryFiles(paths: string[], config: string | null, configDir = ''): string[] {
  const dirs = libraryDirs(config);
  const inLibrary = (path: string) => (dirs ? dirs.some((d) => path.startsWith(`${configDir}${d}`)) : COMPONENT_DIR.test(path));
  return paths.filter((p) => STORY_FILE.test(p) || (LIBRARY_FILE.test(p) && !NOT_LIBRARY.test(p) && inLibrary(p))).slice(0, LIBRARY_LIMITS.files);
}

export async function discoverIn(paths: string[], read: ReadMany): Promise<Discovery> {
  const config = paths.filter((p) => posix.basename(p) === SHADCN_CONFIG).sort((a, b) => a.length - b.length)[0];
  const text = config ? ((await read([config]))[config] ?? null) : null;
  const wanted = libraryFiles(paths, text, config ? posix.dirname(config).replace(/^\.$/, '').replace(/(.)$/, '$1/') : '');
  return discover(wanted.length ? await read(wanted) : {});
}

const literalOf = (node: ts.Node | undefined): string | undefined => {
  if (!node) {
    return undefined;
  }
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return node.getText();
  }
  return ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand) ? `-${node.operand.text}` : undefined;
};

const keyOf = (name: ts.PropertyName | ts.BindingName): string | null => (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name) ? name.text : null);

const unwrapped = (node: ts.Expression): ts.Expression => (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node) ? unwrapped(node.expression) : node);

function objectEntries(node: ts.Node | undefined): [string, ts.Expression][] {
  const object = node && ts.isObjectLiteralExpression(unwrapped(node as ts.Expression)) ? (unwrapped(node as ts.Expression) as ts.ObjectLiteralExpression) : null;
  return (object?.properties ?? []).flatMap((p) => (ts.isPropertyAssignment(p) && keyOf(p.name) ? [[keyOf(p.name)!, p.initializer] as [string, ts.Expression]] : []));
}

function variantProps(call: ts.CallExpression, source: AxisSource): Prop[] {
  const options = call.arguments.find((a) => ts.isObjectLiteralExpression(a) && objectEntries(a).some(([k]) => k === 'variants'));
  const entries = new Map(objectEntries(options));
  const defaults = new Map(objectEntries(entries.get('defaultVariants')).map(([k, v]) => [k, literalOf(v)]));
  return objectEntries(entries.get('variants')).map(([name, values]) => {
    const keys = objectEntries(values).map(([k]) => k);
    const shape: Shape = keys.every((k) => BOOLEAN_VALUES.includes(k)) ? { kind: Kind.Boolean } : { kind: Kind.Axis, values: keys, source, default: defaults.get(name) };
    return { name, shape };
  });
}

function scopeOf(file: string, sf: ts.SourceFile, files: Map<string, Scope | null>, hop: boolean): Scope {
  const scope: Scope = { file, types: new Map(), enums: new Map(), variants: new Map(), imports: new Map(), files, hop };
  for (const statement of sf.statements) {
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      scope.types.set(statement.name.text, statement);
    } else if (ts.isEnumDeclaration(statement)) {
      scope.enums.set(statement.name.text, statement.members.map((m) => literalOf(m.initializer) ?? keyOf(m.name) ?? ''));
    } else if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      importsOf(statement, scope);
    } else if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        const call = d.initializer && ts.isCallExpression(d.initializer) ? d.initializer : null;
        const source = call ? VARIANT_CALLS[call.expression.getText()] : undefined;
        if (call && source && ts.isIdentifier(d.name)) {
          scope.variants.set(d.name.text, variantProps(call, source));
        }
      }
    }
  }
  return scope;
}

function importsOf(statement: ts.ImportDeclaration, scope: Scope) {
  const from = (statement.moduleSpecifier as ts.StringLiteral).text;
  const bindings = statement.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) {
    return;
  }
  for (const el of bindings.elements) {
    scope.imports.set(el.name.text, { from, name: (el.propertyName ?? el.name).text });
  }
}

type Found<T> = { value: T; scope: Scope } | { missing: true } | null;

function found<T>(scope: Scope, name: string, table: (s: Scope) => Map<string, T>): Found<T> {
  const own = table(scope).get(name);
  if (own !== undefined) {
    return { value: own, scope };
  }
  const imported = scope.imports.get(name);
  if (!imported) {
    return null;
  }
  const target = scope.hop ? null : neighbour(scope, imported.from);
  const value = target ? table(target).get(imported.name) : undefined;
  return target && value !== undefined ? { value, scope: target } : { missing: true };
}

function neighbour(scope: Scope, from: string): Scope | null {
  if (!from.startsWith('.')) {
    return null;
  }
  const base = posix.normalize(posix.join(posix.dirname(scope.file), from));
  const path = IMPORT_EXTENSIONS.map((ext) => `${base}${ext}`).find((p) => scope.files.has(p));
  return path ? (scope.files.get(path) ?? null) : null;
}

const shapeOfName = (name: string): Shape => (TEXT_TYPES.has(name) ? { kind: Kind.Text } : IGNORED);

function shapeOf(node: ts.TypeNode, scope: Scope): Shape {
  if (ts.isParenthesizedTypeNode(node)) {
    return shapeOf(node.type, scope);
  }
  if (ts.isUnionTypeNode(node)) {
    return unionShape(node.types.filter((t) => !isNothing(t)).map((t) => shapeOf(t, scope)));
  }
  if (ts.isLiteralTypeNode(node)) {
    const value = literalOf(node.literal);
    return value === undefined ? IGNORED : BOOLEAN_VALUES.includes(value) ? { kind: Kind.Boolean } : { kind: Kind.Axis, values: [value], source: AxisSource.Union };
  }
  if (node.kind === ts.SyntaxKind.BooleanKeyword) {
    return { kind: Kind.Boolean };
  }
  if (node.kind === ts.SyntaxKind.StringKeyword) {
    return { kind: Kind.Text };
  }
  return ts.isTypeReferenceNode(node) ? referenceShape(node, scope) : IGNORED;
}

function referenceShape(node: ts.TypeReferenceNode, scope: Scope): Shape {
  if (ts.isQualifiedName(node.typeName)) {
    return shapeOfName(node.typeName.right.text);
  }
  const name = node.typeName.text;
  const asEnum = found(scope, name, (s) => s.enums);
  if (asEnum && 'value' in asEnum) {
    return { kind: Kind.Axis, values: asEnum.value, source: AxisSource.Enum };
  }
  const asType = found(scope, name, (s) => s.types);
  if (asType && 'value' in asType) {
    return ts.isTypeAliasDeclaration(asType.value) ? shapeOf(asType.value.type, asType.scope) : IGNORED;
  }
  if (TEXT_TYPES.has(name)) {
    return { kind: Kind.Text };
  }
  return asType && 'missing' in asType && !node.typeArguments ? { kind: Kind.Unresolved } : IGNORED;
}

const isNothing = (t: ts.TypeNode) => t.kind === ts.SyntaxKind.UndefinedKeyword || (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword);

function unionShape(shapes: Shape[]): Shape {
  if (shapes.length && shapes.every((s) => s.kind === Kind.Axis)) {
    const axes = shapes as Extract<Shape, { kind: Kind.Axis }>[];
    return { kind: Kind.Axis, values: [...new Set(axes.flatMap((s) => s.values))], source: axes[0].source };
  }
  const kinds = new Set(shapes.map((s) => s.kind));
  const first = [Kind.Text, Kind.Unresolved].find((k) => kinds.has(k));
  return first ? { kind: first } : kinds.size === 1 && kinds.has(Kind.Boolean) ? { kind: Kind.Boolean } : IGNORED;
}

function propsOfType(node: ts.Node | undefined, scope: Scope): Prop[] {
  if (!node) {
    return [];
  }
  if (ts.isTypeLiteralNode(node) || ts.isInterfaceDeclaration(node)) {
    const inherited = ts.isInterfaceDeclaration(node) ? (node.heritageClauses ?? []).flatMap((h) => h.types.flatMap((t) => heritageProps(t, scope))) : [];
    return [...inherited, ...node.members.flatMap((m) => (ts.isPropertySignature(m) && m.type && keyOf(m.name) ? [{ name: keyOf(m.name)!, shape: shapeOf(m.type, scope) }] : []))];
  }
  if (ts.isIntersectionTypeNode(node) || ts.isParenthesizedTypeNode(node)) {
    return ts.isParenthesizedTypeNode(node) ? propsOfType(node.type, scope) : node.types.flatMap((t) => propsOfType(t, scope));
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return propsOfType(node.type, scope);
  }
  return ts.isTypeReferenceNode(node) ? referenceProps(node.typeName.getText(), node.typeArguments?.[0], scope) : [];
}

const heritageProps = (t: ts.ExpressionWithTypeArguments, scope: Scope) => referenceProps(t.expression.getText(), t.typeArguments?.[0], scope);

function referenceProps(name: string, argument: ts.TypeNode | undefined, scope: Scope): Prop[] {
  if (name === 'VariantProps' && argument && ts.isTypeQueryNode(argument)) {
    const variants = found(scope, argument.exprName.getText(), (s) => s.variants);
    return variants && 'value' in variants ? variants.value : [];
  }
  const declared = found(scope, name, (s) => s.types);
  return declared && 'value' in declared ? propsOfType(declared.value, declared.scope) : [];
}

function defaultsOf(pattern: ts.BindingName | undefined): Map<string, string | undefined> {
  if (!pattern || !ts.isObjectBindingPattern(pattern)) {
    return new Map();
  }
  return new Map(pattern.elements.flatMap((el) => {
    const name = keyOf(el.propertyName ?? el.name);
    return name && !el.dotDotDotToken ? [[name, literalOf(el.initializer)] as [string, string | undefined]] : [];
  }));
}

function bindingProps(pattern: ts.BindingName | undefined): Prop[] {
  return [...defaultsOf(pattern)].map(([name, value]) => ({ name, shape: value === undefined ? IGNORED : inferred(value) }));
}

const inferred = (value: string): Shape => (BOOLEAN_VALUES.includes(value) ? { kind: Kind.Boolean } : IGNORED);

function withDefaults(props: Prop[], defaults: Map<string, string | undefined>): Prop[] {
  const typed = new Set(props.map((p) => p.name));
  const own = props.map((p) => (p.shape.kind === Kind.Axis && defaults.get(p.name) !== undefined ? { ...p, shape: { ...p.shape, default: defaults.get(p.name) } } : p));
  return [...own, ...[...defaults].filter(([n, v]) => !typed.has(n) && v !== undefined).map(([name, v]) => ({ name, shape: inferred(v!) }))];
}

type Candidate = { name: string; exported: ExportKind; props: Prop[] };

function componentOf(file: string, candidate: Candidate, defaults: Map<string, string | undefined>): DiscoveredComponent {
  const axes: Record<string, Axis> = {};
  const texts: string[] = [];
  const unresolved: string[] = [];
  for (const { name, shape } of candidate.props) {
    if (name in axes) {
      continue;
    }
    if (shape.kind === Kind.Axis) {
      axes[name] = { values: shape.values, default: shape.default ?? null, evidence: [shape.source] };
    } else if (shape.kind === Kind.Boolean) {
      axes[name] = { values: BOOLEAN_VALUES, default: defaults.get(name) ?? null, evidence: [AxisSource.Boolean] };
    } else if (shape.kind === Kind.Text && !NOT_TEXT.test(name)) {
      texts.push(name);
    } else if (shape.kind === Kind.Unresolved) {
      unresolved.push(name);
    }
  }
  const states = Object.keys(axes).filter((k) => STATE_PROPS.has(k) && axes[k].evidence.includes(AxisSource.Boolean));
  return { name: candidate.name, file, exported: candidate.exported, axes, texts: [...new Set(texts)], states, unresolved };
}

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) => (ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []).some((m) => m.kind === kind) : false);

function rendersMarkup(node: ts.Node): boolean {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
    return true;
  }
  if (ts.isCallExpression(node) && /(^|\.)createElement$/.test(node.expression.getText())) {
    return true;
  }
  return ts.forEachChild(node, rendersMarkup) ?? false;
}

type Fn = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;

const isFn = (node: ts.Node | undefined): node is Fn => !!node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node));

function fnProps(fn: Fn, typeArg: ts.TypeNode | undefined, scope: Scope): { props: Prop[]; defaults: Map<string, string | undefined> } {
  const param = fn.parameters[0];
  const defaults = defaultsOf(param?.name);
  const typed = propsOfType(typeArg ?? param?.type, scope);
  return { props: typed.length ? withDefaults(typed, defaults) : bindingProps(param?.name), defaults };
}

function functionOf(init: ts.Expression | undefined): { fn: Fn; typeArg?: ts.TypeNode } | null {
  if (isFn(init)) {
    return { fn: init };
  }
  if (!init || !ts.isCallExpression(init) || !WRAPPERS.test(init.expression.getText())) {
    return null;
  }
  const inner = functionOf(init.arguments[0]);
  return inner ? { fn: inner.fn, typeArg: inner.typeArg ?? init.typeArguments?.[1] } : null;
}

const capitalised = (name: string) => /^[A-Z]/.test(name);

function scriptComponents(file: string, sf: ts.SourceFile, scope: Scope): DiscoveredComponent[] {
  const exported = new Map<string, ExportKind>();
  const fns = new Map<string, { fn: Fn; typeArg?: ts.TypeNode }>();
  for (const s of sf.statements) {
    const isExported = hasModifier(s, ts.SyntaxKind.ExportKeyword);
    const kind = hasModifier(s, ts.SyntaxKind.DefaultKeyword) ? ExportKind.Default : ExportKind.Named;
    if (ts.isFunctionDeclaration(s)) {
      const name = s.name?.text ?? componentName(file);
      fns.set(name, { fn: s });
      if (isExported) {
        exported.set(name, kind);
      }
    } else if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const fn = ts.isIdentifier(d.name) ? functionOf(d.initializer) : null;
        if (fn) {
          fns.set((d.name as ts.Identifier).text, fn);
        }
        if (fn && isExported) {
          exported.set((d.name as ts.Identifier).text, ExportKind.Named);
        }
      }
    } else if (ts.isExportDeclaration(s) && s.exportClause && ts.isNamedExports(s.exportClause) && !s.moduleSpecifier) {
      s.exportClause.elements.forEach((el) => exported.set((el.propertyName ?? el.name).text, el.name.text === 'default' ? ExportKind.Default : ExportKind.Named));
    } else if (ts.isExportAssignment(s) && ts.isIdentifier(s.expression)) {
      exported.set(s.expression.text, ExportKind.Default);
    }
  }
  return [...exported].flatMap(([name, kind]) => {
    const fn = fns.get(name);
    if (!fn || !capitalised(name) || !rendersMarkup(fn.fn)) {
      return [];
    }
    const { props, defaults } = fnProps(fn.fn, fn.typeArg, scope);
    return [componentOf(file, { name, exported: kind, props }, defaults)];
  });
}

const componentName = (file: string) => posix.basename(file).replace(/\..*$/, '');

const SCRIPT = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
const MODULE_SCRIPT = /context=["']module["']|\bmodule\b/;
const SETUP_SCRIPT = /\bsetup\b/;

function svelteProps(sf: ts.SourceFile, scope: Scope): { props: Prop[]; defaults: Map<string, string | undefined> } {
  const runes = sf.statements.flatMap((s) => (ts.isVariableStatement(s) ? [...s.declarationList.declarations] : [])).find((d) => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText() === '$props');
  if (runes) {
    const defaults = defaultsOf(runes.name);
    const typed = propsOfType(runes.type, scope);
    return { props: typed.length ? withDefaults(typed, defaults) : bindingProps(runes.name), defaults };
  }
  const exportedLets = sf.statements.filter((s): s is ts.VariableStatement => ts.isVariableStatement(s) && hasModifier(s, ts.SyntaxKind.ExportKeyword) && (s.declarationList.flags & ts.NodeFlags.Let) !== 0).flatMap((s) => [...s.declarationList.declarations]);
  const defaults = new Map(exportedLets.flatMap((d) => (ts.isIdentifier(d.name) ? [[d.name.text, literalOf(d.initializer)] as [string, string | undefined]] : [])));
  const props = exportedLets.flatMap((d) => (ts.isIdentifier(d.name) ? [{ name: d.name.text, shape: d.type ? shapeOf(d.type, scope) : inferredOf(d.initializer) }] : []));
  return { props: withDefaults(props, defaults), defaults };
}

const inferredOf = (init: ts.Expression | undefined): Shape => {
  const value = literalOf(init);
  return value === undefined ? IGNORED : BOOLEAN_VALUES.includes(value) ? { kind: Kind.Boolean } : init && ts.isStringLiteralLike(init) ? { kind: Kind.Text } : IGNORED;
};

const RUNTIME_TYPES: Record<string, Shape> = { Boolean: { kind: Kind.Boolean }, String: { kind: Kind.Text } };

function runtimeProp(name: string, value: ts.Expression, scope: Scope): Prop {
  if (ts.isIdentifier(value)) {
    return { name, shape: RUNTIME_TYPES[value.text] ?? IGNORED };
  }
  const entries = new Map(objectEntries(value));
  const type = entries.get('type');
  const typed = type && ts.isAsExpression(type) && ts.isTypeReferenceNode(type.type) && type.type.typeArguments?.[0] ? shapeOf(type.type.typeArguments[0], scope) : type && ts.isIdentifier(type) ? (RUNTIME_TYPES[type.text] ?? IGNORED) : IGNORED;
  return { name, shape: typed.kind === Kind.Axis ? { ...typed, default: literalOf(entries.get('default')) } : typed };
}

function vueProps(sf: ts.SourceFile, scope: Scope): { props: Prop[]; defaults: Map<string, string | undefined> } {
  let define: ts.CallExpression | null = null;
  let defaults = new Map<string, string | undefined>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText() === 'withDefaults') {
      defaults = new Map(objectEntries(node.arguments[1]).map(([k, v]) => [k, literalOf(v)]));
    }
    if (ts.isCallExpression(node) && node.expression.getText() === 'defineProps') {
      define = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const call = define as ts.CallExpression | null;
  if (!call) {
    return { props: [], defaults };
  }
  const typed = call.typeArguments?.[0] ? propsOfType(call.typeArguments[0], scope) : objectEntries(call.arguments[0]).map(([k, v]) => runtimeProp(k, v, scope));
  return { props: withDefaults(typed, defaults), defaults };
}

const parsed = (file: string, text: string, kind: ts.ScriptKind) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);

const SCRIPT_KINDS: Record<string, ts.ScriptKind> = { '.tsx': ts.ScriptKind.TSX, '.jsx': ts.ScriptKind.JSX, '.ts': ts.ScriptKind.TS, '.js': ts.ScriptKind.JSX };

function blockOf(text: string, keep: (attrs: string) => boolean): string {
  return [...text.matchAll(SCRIPT)].filter((m) => keep(m[1] ?? '')).map((m) => m[2]).join('\n');
}

type Reader = { source: (file: string, text: string) => ts.SourceFile; components: (file: string, sf: ts.SourceFile, scope: Scope) => DiscoveredComponent[] };

const singleFile = (read: (sf: ts.SourceFile, scope: Scope) => { props: Prop[]; defaults: Map<string, string | undefined> }) => (file: string, sf: ts.SourceFile, scope: Scope) => {
  const { props, defaults } = read(sf, scope);
  return [componentOf(file, { name: componentName(file), exported: ExportKind.Default, props }, defaults)];
};

const READERS: [RegExp, Reader][] = [
  [/\.svelte$/, { source: (file, text) => parsed(file, blockOf(text, (a) => !MODULE_SCRIPT.test(a)), ts.ScriptKind.TS), components: singleFile(svelteProps) }],
  [/\.vue$/, { source: (file, text) => parsed(file, blockOf(text, (a) => SETUP_SCRIPT.test(a)), ts.ScriptKind.TS), components: singleFile(vueProps) }],
  [/\.(tsx|jsx|ts|js)$/, { source: (file, text) => parsed(file, text, SCRIPT_KINDS[posix.extname(file)]), components: scriptComponents }]
];

const readerOf = (file: string) => READERS.find(([pattern]) => pattern.test(file))?.[1] ?? null;

function storyAxes(sf: ts.SourceFile): { component: string; axes: Record<string, string[]> } | null {
  const assignment = sf.statements.find(ts.isExportAssignment);
  if (!assignment) {
    return null;
  }
  const declared = ts.isIdentifier(assignment.expression)
    ? sf.statements.flatMap((s) => (ts.isVariableStatement(s) ? [...s.declarationList.declarations] : [])).find((d) => ts.isIdentifier(d.name) && d.name.text === (assignment.expression as ts.Identifier).text)?.initializer
    : assignment.expression;
  const meta = new Map(objectEntries(declared));
  const component = meta.get('component');
  if (!component || !ts.isIdentifier(component)) {
    return null;
  }
  const axes = Object.fromEntries(
    objectEntries(meta.get('argTypes')).flatMap(([name, spec]) => {
      const own = new Map(objectEntries(spec));
      const options = own.get('options') ?? new Map(objectEntries(own.get('control'))).get('options');
      const values = options && ts.isArrayLiteralExpression(options) ? options.elements.flatMap((e) => (ts.isStringLiteralLike(e) ? [e.text] : [])) : [];
      return values.length ? [[name, values]] : [];
    })
  );
  return { component: component.text, axes };
}

function withStory(component: DiscoveredComponent, axes: Record<string, string[]>): DiscoveredComponent {
  const merged = { ...component.axes };
  for (const [name, values] of Object.entries(axes)) {
    const known = merged[name] ?? { values: [], default: null, evidence: [] };
    merged[name] = { ...known, values: [...new Set([...known.values, ...values])], evidence: [...new Set([...known.evidence, AxisSource.Story])] };
  }
  return { ...component, axes: merged };
}

export function discover(files: Record<string, string>): Discovery {
  const sources = new Map(
    Object.entries(files).flatMap(([file, text]) => {
      const reader = readerOf(file);
      return reader && text.length <= LIBRARY_LIMITS.bytes ? [[file, { reader, sf: reader.source(file, text) }] as const] : [];
    })
  );
  const scopes = new Map<string, Scope | null>();
  for (const [file, { sf }] of sources) {
    scopes.set(file, scopeOf(file, sf, scopes, true));
  }

  const components = [...sources].filter(([file]) => !STORY_FILE.test(file)).flatMap(([file, { reader, sf }]) => reader.components(file, sf, { ...scopes.get(file)!, hop: false }));
  const stories = [...sources].filter(([file]) => STORY_FILE.test(file)).flatMap(([, { sf }]) => storyAxes(sf) ?? []);
  return { components: components.map((c) => stories.filter((s) => s.component === c.name).reduce((acc, s) => withStory(acc, s.axes), c)) };
}

export function cellsOf(component: DiscoveredComponent): Record<string, string>[] {
  const axes = Object.entries(component.axes);
  const size = axes.reduce((n, [, a]) => n * a.values.length, 1);
  if (size <= LIBRARY_LIMITS.cells) {
    return axes.reduce<Record<string, string>[]>((cells, [name, axis]) => cells.flatMap((cell) => axis.values.map((v) => ({ ...cell, [name]: v }))), [{}]);
  }
  const base = Object.fromEntries(axes.map(([name, a]) => [name, a.default ?? a.values[0]]));
  return [base, ...axes.flatMap(([name, a]) => a.values.filter((v) => v !== base[name]).map((v) => ({ ...base, [name]: v })))];
}
