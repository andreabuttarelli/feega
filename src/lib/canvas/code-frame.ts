export enum Framework {
  React = 'react',
  Svelte = 'svelte'
}

export type CodeFiles = Record<string, string>;

const ESM = 'https://esm.sh';
const REACT_VERSION = '19.1.0';
const SVELTE_VERSION = '5.38.0';
const SUCRASE_URL = `${ESM}/sucrase@3.35.0`;
const LEXER_URL = `${ESM}/es-module-lexer@1.7.0`;
const TAILWIND_URL = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.11';

export const CODE_ENTRY: Record<Framework, string> = {
  [Framework.React]: 'App.tsx',
  [Framework.Svelte]: 'App.svelte'
};

type Runtime = { imports: Record<string, string>; external: string; compiler: string };

const RUNTIME: Record<Framework, Runtime> = {
  [Framework.React]: {
    imports: {
      react: `${ESM}/react@${REACT_VERSION}`,
      'react/': `${ESM}/react@${REACT_VERSION}/`,
      'react-dom': `${ESM}/react-dom@${REACT_VERSION}`,
      'react-dom/': `${ESM}/react-dom@${REACT_VERSION}/`
    },
    external: 'react,react-dom',
    compiler: SUCRASE_URL
  },
  [Framework.Svelte]: {
    imports: {
      svelte: `${ESM}/svelte@${SVELTE_VERSION}`,
      'svelte/': `${ESM}/svelte@${SVELTE_VERSION}/`
    },
    external: 'svelte',
    compiler: `${ESM}/svelte@${SVELTE_VERSION}/compiler`
  }
};

const STARTER: Record<Framework, CodeFiles> = {
  [Framework.React]: {
    'App.tsx': `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="grid min-h-screen place-items-center bg-white font-sans">
      <button className="rounded-md bg-black px-4 py-2 text-white" onClick={() => setCount(count + 1)}>
        Clicked {count} times
      </button>
    </main>
  );
}
`
  },
  [Framework.Svelte]: {
    'App.svelte': `<script lang="ts">
  let count = $state(0);
</script>

<main class="grid min-h-screen place-items-center bg-white font-sans">
  <button class="rounded-md bg-black px-4 py-2 text-white" onclick={() => count++}>
    Clicked {count} times
  </button>
</main>
`
  }
};

export function starterFiles(framework: Framework): CodeFiles {
  return { ...STARTER[framework] };
}

export function isFramework(x: unknown): x is Framework {
  return (Object.values(Framework) as unknown[]).includes(x);
}

export function isCodeFiles(x: unknown): x is CodeFiles {
  return typeof x === 'object' && x !== null && !Array.isArray(x) && Object.values(x).every((v) => typeof v === 'string');
}

export function codeFilesOf(data: Record<string, unknown> | undefined): CodeFiles {
  return isCodeFiles(data?.files) ? data.files : {};
}

const inert = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

const BOOTSTRAP = `
const config = JSON.parse(document.getElementById('feega-config').textContent);
const files = JSON.parse(document.getElementById('feega-files').textContent);
let failed = false;

function fail(title, detail) {
  if (failed) return;
  failed = true;
  const box = document.createElement('pre');
  box.id = 'feega-error';
  box.textContent = title + '\\n\\n' + detail;
  document.body.append(box);
}

const describe = (e) => String((e && (e.stack || e.message)) || e);
addEventListener('error', (e) => fail('Runtime error', describe(e.error || e.message)));
addEventListener('unhandledrejection', (e) => fail('Runtime error', describe(e.reason)));

const SUFFIXES = ['', '.tsx', '.ts', '.jsx', '.js', '.svelte', '.css', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];

function resolvePath(from, spec) {
  const parts = spec.startsWith('/') ? [] : from.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  const joined = parts.join('/');
  const hit = SUFFIXES.map((s) => joined + s).find((p) => Object.hasOwn(files, p));
  if (!hit) throw new Error('Cannot find "' + spec + '" imported by ' + from);
  return hit;
}

const mapped = Object.keys(config.imports).filter((k) => !k.endsWith('/'));
const fromNpm = (spec) => mapped.some((m) => spec === m || spec.startsWith(m + '/'))
  ? spec
  : config.esm + '/' + spec + (spec.includes('?') ? '&' : '?') + 'external=' + config.external;

let lexer;
let sucrase;
let svelte;

async function typescript(source, path) {
  sucrase ??= await import(config.sucrase);
  const transforms = /x$/.test(path) ? ['typescript', 'jsx'] : ['typescript'];
  return sucrase.transform(source, { transforms, jsxRuntime: 'automatic', production: true, filePath: path }).code;
}

async function compile(path, source) {
  if (path.endsWith('.css')) {
    return 'const s = document.createElement("style"); s.textContent = ' + JSON.stringify(source) + '; document.head.append(s);';
  }
  if (path.endsWith('.svelte')) {
    svelte ??= await import(config.compiler);
    return svelte.compile(source, { filename: path, generate: 'client', css: 'injected' }).js.code;
  }
  return typescript(source, path);
}

class BuildError extends Error {
  constructor(title, detail) {
    super(detail);
    this.title = title;
  }
}

const loading = new Map();

function load(path, chain) {
  if (chain.includes(path)) {
    throw new BuildError('Circular import', [...chain, path].join(' -> '));
  }
  if (!loading.has(path)) loading.set(path, build(path, [...chain, path]));
  return loading.get(path);
}

async function build(path, chain) {
  let code;
  try {
    code = await compile(path, files[path]);
  } catch (e) {
    throw new BuildError('Compile error in ' + path, (e.message || String(e)) + (e.frame ? '\\n\\n' + e.frame : ''));
  }

  const [imports] = lexer.parse(code);
  let out = '';
  let last = 0;
  for (const i of imports) {
    if (!i.n) continue;
    let target;
    try {
      target = /^[./]/.test(i.n) ? await load(resolvePath(path, i.n), chain) : /^https?:/.test(i.n) ? i.n : fromNpm(i.n);
    } catch (e) {
      throw e instanceof BuildError ? e : new BuildError('Compile error in ' + path, e.message);
    }
    out += code.slice(last, i.s) + (i.d > -1 ? JSON.stringify(target) : target);
    last = i.e;
  }
  out += code.slice(last);
  return URL.createObjectURL(new Blob([out], { type: 'text/javascript' }));
}

const MOUNT = {
  react: async (App, root) => {
    const [{ createElement }, { createRoot }] = await Promise.all([import('react'), import('react-dom/client')]);
    createRoot(root, { onUncaughtError: (e) => fail('Runtime error', describe(e)) }).render(createElement(App));
  },
  svelte: async (App, root) => {
    const { mount } = await import('svelte');
    mount(App, { target: root, intro: true });
  }
};

try {
  lexer = await import(config.lexer);
  await lexer.init;
  const entry = await import(await load(config.entry, []));
  if (!entry.default) throw new BuildError('Nothing to show', config.entry + ' must export a component as default');
  await MOUNT[config.framework](entry.default, document.getElementById('root'));
} catch (e) {
  fail(e.title || 'Runtime error', e.title ? e.message : describe(e));
}
`;

const STYLE = `html,body{margin:0;min-height:100%}#feega-error{position:fixed;inset:auto 12px 12px 12px;max-height:60%;overflow:auto;margin:0;padding:12px 14px;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;color:#fff;background:#b42318;border-radius:6px;z-index:2147483647}`;

export function codeFrameHtml(framework: Framework, files: CodeFiles): string {
  const runtime = RUNTIME[framework];
  const config = { framework, entry: CODE_ENTRY[framework], imports: runtime.imports, external: runtime.external, compiler: runtime.compiler, sucrase: SUCRASE_URL, lexer: LEXER_URL, esm: ESM };
  const importMap = JSON.stringify({ imports: runtime.imports }, null, 1);

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="about:srcdoc">
<style>${STYLE}</style>
<script type="importmap">${importMap}</script>
<script src="${TAILWIND_URL}"></script>
</head><body><div id="root"></div>
<script type="application/json" id="feega-config">${inert(config)}</script>
<script type="application/json" id="feega-files">${inert(files)}</script>
<script type="module">${BOOTSTRAP}</script>
</body></html>`;
}
