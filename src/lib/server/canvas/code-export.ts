import ts from 'typescript';
import { parse } from 'svelte/compiler';
import { CODE_ENTRY, ExportMode, Framework, REACT_VERSION, SVELTE_VERSION, type CodeFiles, type VarValues } from '$lib/canvas/code-frame';
import type { VarDecl } from '$lib/canvas/code-vars';
import { NOT_LITERAL, declarationOf, declaredVars, feegaCalls } from './code-source';


export type ExportInput = { framework: Framework; files: CodeFiles; vars: VarValues };

export type ExportResult = { ok: true; files: Record<string, string> } | { ok: false; error: string };

export type VersionOf = (pkg: string) => Promise<string>;

type Edit = { start: number; end: number; text: string };

const RUNTIME_GLOBAL = 'feega';
const ROUTE_PROPERTY = 'route';
const ROOT_ROUTE = '"/"';
const CONTENT_MODULE = 'content';
const CONTENT_FILE = `src/${CONTENT_MODULE}.ts`;
const MEMORY_ROUTER = 'MemoryRouter';
const BROWSER_ROUTER = 'BrowserRouter';
const ROUTER_PACKAGES = ['react-router', 'react-router-dom'];
const MEMORY_ONLY_PROPS = ['initialEntries', 'initialIndex'];
const TAILWIND_VERSION = '^4.1.11';
const VITE_VERSION = '^7.1.0';

type Scaffold = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  pinned: string[];
  files: Record<string, string>;
};

const SCAFFOLD: Record<Framework, Scaffold> = {
  [Framework.React]: {
    dependencies: { react: REACT_VERSION, 'react-dom': REACT_VERSION },
    devDependencies: { vite: VITE_VERSION, '@vitejs/plugin-react': '^5.0.0', tailwindcss: TAILWIND_VERSION, '@tailwindcss/vite': TAILWIND_VERSION },
    pinned: ['react', 'react-dom'],
    files: {
      'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nimport tailwindcss from '@tailwindcss/vite';\n\nexport default defineConfig({ plugins: [react(), tailwindcss()] });\n`,
      'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
      'src/main.tsx': `import { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')!).render(<App />);\n`,
      'tsconfig.json': `${JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', skipLibCheck: true }, include: ['src'] }, null, 2)}\n`
    }
  },
  [Framework.Svelte]: {
    dependencies: {},
    devDependencies: { svelte: SVELTE_VERSION, vite: VITE_VERSION, '@sveltejs/vite-plugin-svelte': '^6.1.0', tailwindcss: TAILWIND_VERSION, '@tailwindcss/vite': TAILWIND_VERSION },
    pinned: ['svelte'],
    files: {
      'vite.config.js': `import { defineConfig } from 'vite';\nimport { svelte } from '@sveltejs/vite-plugin-svelte';\nimport tailwindcss from '@tailwindcss/vite';\n\nexport default defineConfig({ plugins: [svelte(), tailwindcss()] });\n`,
      'svelte.config.js': `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\n\nexport default { preprocess: vitePreprocess() };\n`,
      'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>App</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n`,
      'src/main.ts': `import { mount } from 'svelte';\nimport App from './App.svelte';\nimport './index.css';\n\nmount(App, { target: document.getElementById('app')! });\n`
    }
  }
};

const SHARED_FILES: Record<string, string> = { 'src/index.css': '@import "tailwindcss";\n' };

function applyEdits(source: string, edits: Edit[]): string {
  const kept = edits.filter((e) => !edits.some((o) => o !== e && o.start <= e.start && o.end >= e.end && (o.start !== e.start || o.end !== e.end)));
  return [...kept].sort((a, b) => b.start - a.start).reduce((out, e) => out.slice(0, e.start) + e.text + out.slice(e.end), source);
}

const packageOf = (spec: string) => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');

const isBare = (spec: string) => !/^[./]/.test(spec) && !/^[a-z]+:/i.test(spec);

function relativeTo(path: string, module: string): string {
  const depth = path.split('/').length - 1;
  return depth === 0 ? `./${module}` : `${'../'.repeat(depth)}${module}`;
}

const contentImport = (path: string) => `import { content } from '${relativeTo(path, CONTENT_MODULE)}';`;

type Scan = { edits: Edit[]; imports: string[]; feegaLeft: number };

function scanScript(path: string, source: string): Scan {
  const kind = path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  const scan: Scan = { edits: [], imports: [], feegaLeft: 0 };
  const memoryNames = new Set<string>();

  const rename = (node: ts.Node) => scan.edits.push({ start: node.getStart(file), end: node.end, text: BROWSER_ROUTER });

  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      scan.imports.push(node.moduleSpecifier.text);
      if (ts.isImportDeclaration(node) && ROUTER_PACKAGES.includes(node.moduleSpecifier.text)) {
        const named = node.importClause?.namedBindings;
        for (const spec of named && ts.isNamedImports(named) ? named.elements : []) {
          if ((spec.propertyName ?? spec.name).text === MEMORY_ROUTER) {
            memoryNames.add(spec.name.text);
            rename(spec.propertyName ?? spec.name);
            if (spec.propertyName) {
              scan.edits.push({ start: spec.propertyName.end, end: spec.name.end, text: '' });
            }
          }
        }
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      scan.imports.push(node.arguments[0].text);
    }
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxClosingElement(node)) && ts.isIdentifier(node.tagName) && memoryNames.has(node.tagName.text)) {
      rename(node.tagName);
      if (!ts.isJsxClosingElement(node)) {
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && MEMORY_ONLY_PROPS.includes(attr.name.getText(file))) {
            scan.edits.push({ start: attr.getFullStart(), end: attr.end, text: '' });
          }
        }
      }
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === RUNTIME_GLOBAL && node.name.text === ROUTE_PROPERTY) {
      scan.edits.push({ start: node.getStart(file), end: node.end, text: ROOT_ROUTE });
    }
    if (ts.isIdentifier(node) && node.text === RUNTIME_GLOBAL) {
      scan.feegaLeft++;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return scan;
}

type EsNode = { type: string; start: number; end: number; [key: string]: unknown };

function scanSvelte(_path: string, source: string): Scan {
  const scan: Scan = { edits: [], imports: [], feegaLeft: 0 };
  const seen = new WeakSet<object>();

  const walk = (value: unknown, parentKey: string) => {
    if (typeof value !== 'object' || value === null || seen.has(value)) {
      return;
    }
    seen.add(value);
    const node = value as EsNode;

    if (node.type === 'ImportDeclaration') {
      scan.imports.push(String((node.source as EsNode).value));
    }
    if (node.type === 'MemberExpression' && parentKey !== 'callee' && (node.object as EsNode).type === 'Identifier' && (node.object as EsNode).name === RUNTIME_GLOBAL && (node.property as EsNode).name === ROUTE_PROPERTY) {
      scan.edits.push({ start: node.start, end: node.end, text: ROOT_ROUTE });
    }
    if (node.type === 'Identifier' && node.name === RUNTIME_GLOBAL) {
      scan.feegaLeft++;
    }
    for (const [key, child] of Object.entries(value)) {
      walk(child, key);
    }
  };
  walk(parse(source, { modern: true }), '');

  return scan;
}

const SCANNER: [RegExp, (path: string, source: string) => Scan][] = [
  [/\.svelte$/, scanSvelte],
  [/\.(tsx?|jsx?)$/, scanScript],
  [/./, () => ({ edits: [], imports: [], feegaLeft: 0 })]
];

const scannerOf = (path: string) => SCANNER.find(([test]) => test.test(path))![1];

function insertContentImport(path: string, source: string): string {
  if (!path.endsWith('.svelte')) {
    return `${contentImport(path)}\n${source}`;
  }

  const instance = (parse(source, { modern: true }) as unknown as { instance: { content: EsNode } | null }).instance;
  if (!instance) {
    return `<script lang="ts">\n  ${contentImport(path)}\n</script>\n\n${source}`;
  }
  const at = instance.content.start;
  return `${source.slice(0, at)}\n  ${contentImport(path)}${source.slice(at)}`;
}

const VALUE_OF: Record<ExportMode, (decl: VarDecl, value: unknown) => string> = {
  [ExportMode.Inline]: (_decl, value) => JSON.stringify(value),
  [ExportMode.Config]: (decl) => `content[${JSON.stringify(decl.name)}]`
};

function lineOf(source: string, at: number): number {
  return source.slice(0, at).split('\n').length;
}

function transformFile(path: string, source: string, values: VarValues, mode: ExportMode): { ok: true; source: string; imports: string[] } | { ok: false; error: string } {
  const edits: Edit[] = [];
  for (const call of feegaCalls(path, source)) {
    const decl = declarationOf(call);
    if (!decl) {
      const why = call.name === NOT_LITERAL || call.spec === NOT_LITERAL ? 'its arguments are not literals' : `feega.${call.fn} is not a variable type`;
      return { ok: false, error: `${path}:${lineOf(source, call.start)} cannot be exported: ${why}.` };
    }
    edits.push({ start: call.start, end: call.end, text: VALUE_OF[mode](decl, values[decl.name] ?? decl.default) });
  }

  const scan = scannerOf(path)(path, source);
  let out = applyEdits(source, [...edits, ...scan.edits]);
  if (mode === ExportMode.Config && edits.length) {
    out = insertContentImport(path, out);
  }

  const left = scannerOf(path)(path, out).feegaLeft;
  if (left) {
    return { ok: false, error: `${path} still uses feega in ${left} place(s) that cannot be exported (only feega.route and variable calls can).` };
  }

  return { ok: true, source: out, imports: scan.imports };
}

export async function exportFiles(input: ExportInput, mode: ExportMode, versionOf: VersionOf): Promise<ExportResult> {
  const scaffold = SCAFFOLD[input.framework];
  const decls = declaredVars(input.files);
  const values = Object.fromEntries(decls.map((d) => [d.name, input.vars[d.name] ?? d.default]));

  const files: Record<string, string> = { ...scaffold.files, ...SHARED_FILES };
  const packages = new Set<string>();
  for (const [path, source] of Object.entries(input.files)) {
    let done;
    try {
      done = transformFile(path, source, values, mode);
    } catch (e) {
      return { ok: false, error: `${path} does not parse: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (!done.ok) {
      return done;
    }
    files[`src/${path}`] = done.source;
    done.imports.filter(isBare).map(packageOf).forEach((p) => packages.add(p));
  }

  if (mode === ExportMode.Config) {
    files[CONTENT_FILE] = `export const content = ${JSON.stringify(values, null, 2)} as const;\n`;
  }

  const extra = [...packages].filter((p) => !scaffold.pinned.includes(p)).sort();
  const versions = await Promise.all(extra.map(async (p) => [p, `^${await versionOf(p)}`] as const));
  const pkg = {
    name: 'code-frame-export',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { ...scaffold.dependencies, ...Object.fromEntries(versions) },
    devDependencies: scaffold.devDependencies
  };
  files['package.json'] = `${JSON.stringify(pkg, null, 2)}\n`;

  if (!files[`src/${CODE_ENTRY[input.framework]}`]) {
    return { ok: false, error: `${CODE_ENTRY[input.framework]} is missing` };
  }

  return { ok: true, files };
}

const NPM_LATEST = (pkg: string) => `https://registry.npmjs.org/${pkg}/latest`;

export const npmVersion: VersionOf = async (pkg) => {
  const res = await fetch(NPM_LATEST(pkg));
  if (!res.ok) {
    throw new Error(`${pkg} is not on npm`);
  }
  return ((await res.json()) as { version: string }).version;
};
