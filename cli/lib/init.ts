export const SOURCE_MAP_PACKAGE = 'feega-source-map';
const SOURCE_MAP_RANGE = '^0.1.0';
const PACKAGE_JSON = 'package.json';

export type Framework = 'vite' | 'next';
export type Files = Record<string, string>;
export type InitPlan = { framework: Framework; before: Files; edits: Files };

type Recipe = {
  dependency: string;
  configs: string[];
  importLine: { esm: string; cjs: string };
  apply: (source: string, file: string) => string;
};

const RECIPES: Record<Framework, Recipe> = {
  next: {
    dependency: 'next',
    configs: ['next.config.ts', 'next.config.mjs', 'next.config.js'],
    importLine: {
      esm: `import { withFeegaSource } from '${SOURCE_MAP_PACKAGE}/next';`,
      cjs: `const { withFeegaSource } = require('${SOURCE_MAP_PACKAGE}/next');`
    },
    apply: wrapExport
  },
  vite: {
    dependency: 'vite',
    configs: ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs'],
    importLine: {
      esm: `import { feegaSource } from '${SOURCE_MAP_PACKAGE}/vite';`,
      cjs: `const { feegaSource } = require('${SOURCE_MAP_PACKAGE}/vite');`
    },
    apply: addVitePlugin
  }
};

const DETECTION_ORDER: Framework[] = ['next', 'vite'];

export const PROBED_FILES = [PACKAGE_JSON, ...DETECTION_ORDER.flatMap((f) => RECIPES[f].configs)];

const EXPORT_MARKERS = ['export default ', 'module.exports = '];
const VITE_PLUGINS = 'plugins: [';

export function planInit(files: Files): InitPlan {
  const pkg = JSON.parse(files[PACKAGE_JSON] ?? '{}');
  const framework = detect(pkg);
  const recipe = RECIPES[framework];
  const configFile = recipe.configs.find((name) => name in files);
  if (!configFile) {
    throw new Error(`No ${recipe.configs[0]} found: create one, then run feega init again.`);
  }

  const edits: Files = {};
  const config = files[configFile];
  if (!config.includes(SOURCE_MAP_PACKAGE)) {
    edits[configFile] = withImport(recipe.apply(config, configFile), recipe, isCommonJs(config));
  }
  if (!hasDependency(pkg, SOURCE_MAP_PACKAGE)) {
    edits[PACKAGE_JSON] = withDevDependency(files[PACKAGE_JSON], pkg);
  }

  const before = Object.fromEntries(Object.keys(edits).map((name) => [name, files[name]]));
  return { framework, before, edits };
}

export function formatPlan(plan: InitPlan): string {
  const names = Object.keys(plan.edits);
  if (names.length === 0) {
    return `Already set up for ${plan.framework}: nothing to change.`;
  }

  const sections = names.map((name) => [`--- ${name}`, ...lineDiff(plan.before[name], plan.edits[name])].join('\n'));
  return [`Detected ${plan.framework}.`, ...sections].join('\n\n');
}

function detect(pkg: { dependencies?: Files; devDependencies?: Files }): Framework {
  const framework = DETECTION_ORDER.find((name) => hasDependency(pkg, RECIPES[name].dependency));
  if (!framework) {
    throw new Error('No vite or next dependency in package.json: feega init supports Vite and Next.js projects.');
  }
  return framework;
}

function hasDependency(pkg: { dependencies?: Files; devDependencies?: Files }, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]);
}

function isCommonJs(source: string): boolean {
  return source.includes('module.exports') || /\brequire\(/.test(source);
}

function withImport(source: string, recipe: Recipe, commonJs: boolean): string {
  const line = commonJs ? recipe.importLine.cjs : recipe.importLine.esm;
  const lines = source.split('\n');
  const lastImport = lines.findLastIndex((l) => /^(import\s|const .*= require\()/.test(l));
  if (lastImport === -1) {
    return `${line}\n\n${source}`;
  }

  lines.splice(lastImport + 1, 0, line);
  return lines.join('\n');
}

function wrapExport(source: string, file: string): string {
  const marker = EXPORT_MARKERS.find((m) => source.includes(m));
  if (!marker) {
    throw new Error(`No default export in ${file}: wrap your config with withFeegaSource(...) by hand.`);
  }

  const at = source.lastIndexOf(marker) + marker.length;
  const value = source.slice(at).trimEnd().replace(/;$/, '');
  return `${source.slice(0, at)}withFeegaSource(${value});\n`;
}

function addVitePlugin(source: string, file: string): string {
  if (!source.includes(VITE_PLUGINS)) {
    throw new Error(`No "plugins: [" in ${file}: add feegaSource() to your plugins by hand.`);
  }
  return source.replace(/plugins: \[(\s*)(\]?)/, (_, space: string, close: string) =>
    close ? `${VITE_PLUGINS}feegaSource()]` : `${VITE_PLUGINS}${space}feegaSource(),${space || ' '}`
  );
}

function withDevDependency(raw: string, pkg: { devDependencies?: Files }): string {
  const indent = /^(\s+)"/m.exec(raw)?.[1] ?? '  ';
  const next = { ...pkg, devDependencies: { ...pkg.devDependencies, [SOURCE_MAP_PACKAGE]: SOURCE_MAP_RANGE } };
  return `${JSON.stringify(next, null, indent)}\n`;
}

function lineDiff(before: string, after: string): string[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const common = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      common[i][j] = a[i] === b[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }

  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (i < a.length && (j === b.length || common[i + 1][j] >= common[i][j + 1])) {
      out.push(`- ${a[i++]}`);
      continue;
    }
    out.push(`+ ${b[j++]}`);
  }
  return out;
}
