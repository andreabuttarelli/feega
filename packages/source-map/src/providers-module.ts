import { parse } from '@babel/parser';

type Node = { type: string; start: number; end: number; [key: string]: any };

const RENDER = 'render';
const CHILDREN_SLOT = '{children}';
const DECLARATIONS = new Set(['VariableDeclaration', 'FunctionDeclaration', 'ClassDeclaration']);

function walk(node: unknown, visit: (node: Node) => boolean | void): void {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (!node || typeof (node as Node).type !== 'string') {
    return;
  }
  if (visit(node as Node) === false) {
    return;
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      walk(value, visit);
    }
  }
}

function renderedTree(statement: Node): Node | null {
  let tree: Node | null = null;
  walk(statement, (node) => {
    const isRender = node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property?.name === RENDER;
    const argument = isRender ? node.arguments[0] : null;
    if (argument && (argument.type === 'JSXElement' || argument.type === 'JSXFragment')) {
      tree = argument;
    }
    return !tree;
  });
  return tree;
}

function onlyChild(element: Node): Node | null {
  const meaningful = element.children.filter((child: Node) => !(child.type === 'JSXText' && child.value.trim() === ''));
  return meaningful.length === 1 && meaningful[0].type === 'JSXElement' ? meaningful[0] : null;
}

function leafOf(root: Node): Node {
  let leaf = root;
  for (let next = onlyChild(leaf); next; next = onlyChild(leaf)) {
    leaf = next;
  }
  return leaf;
}

function namesIn(node: Node, skip: Node | null): Set<string> {
  const names = new Set<string>();
  walk(node, (inner) => {
    if (inner === skip) {
      return false;
    }
    if (inner.type === 'JSXIdentifier' || inner.type === 'Identifier') {
      names.add(inner.name);
    }
  });
  return names;
}

function declaredNames(statement: Node): string[] {
  if (statement.type !== 'VariableDeclaration') {
    return statement.id ? [statement.id.name] : [];
  }
  return statement.declarations.flatMap((d: Node) => [...namesIn(d.id, null)]);
}

function closure(needed: Set<string>, declarations: Node[]): Node[] {
  const kept = new Set<Node>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const declaration of declarations) {
      if (!kept.has(declaration) && declaredNames(declaration).some((name) => needed.has(name))) {
        kept.add(declaration);
        namesIn(declaration, null).forEach((name) => needed.add(name));
        grew = true;
      }
    }
  }
  return declarations.filter((declaration) => kept.has(declaration));
}

function importText(code: string, statement: Node, needed: Set<string>): string | null {
  const specifiers: Node[] = statement.specifiers;
  if (statement.importKind === 'type') {
    return null;
  }
  if (!specifiers.length) {
    return code.slice(statement.start, statement.end);
  }
  const kept = specifiers.filter((s) => needed.has(s.local.name));
  if (!kept.length) {
    return null;
  }
  if (kept.length === specifiers.length) {
    return code.slice(statement.start, statement.end);
  }
  const from = code.slice(statement.source.start, statement.source.end);
  const def = kept.find((s) => s.type === 'ImportDefaultSpecifier');
  const ns = kept.find((s) => s.type === 'ImportNamespaceSpecifier');
  const named = kept.filter((s) => s.type === 'ImportSpecifier').map((s) => (s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`));
  const parts = [def?.local.name, ns && `* as ${ns.local.name}`, named.length ? `{ ${named.join(', ')} }` : null].filter(Boolean);
  return `import ${parts.join(', ')} from ${from};`;
}

export function providersOf(code: string): string | null {
  let body: Node[];
  try {
    body = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] }).program.body as Node[];
  } catch {
    return null;
  }

  const rendering = body.find((statement) => renderedTree(statement));
  const root = rendering && renderedTree(rendering);
  if (!root) {
    return null;
  }

  const leaf = leafOf(root);
  const wrapped = leaf === root ? 'children' : `(${code.slice(root.start, leaf.start)}${CHILDREN_SLOT}${code.slice(leaf.end, root.end)})`;
  const needed = namesIn(root, leaf);
  const declarations = closure(needed, body.filter((statement) => DECLARATIONS.has(statement.type)));
  const imports = body.filter((statement) => statement.type === 'ImportDeclaration').flatMap((statement) => importText(code, statement, needed) ?? []);

  return [...imports, ...declarations.map((d) => code.slice(d.start, d.end)), `export function Providers({ children }) {\n  return ${wrapped};\n}`].join('\n') + '\n';
}
