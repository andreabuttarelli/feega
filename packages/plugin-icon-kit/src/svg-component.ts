import { Framework } from '@feega/plugin-api/protocol';

export type Prop = { name: string; fallback: number | string };

export type SvgSpec = {
  name: string;
  viewBox: string;
  body: string;
  fixed: Record<string, string>;
  bound: Record<string, string>;
  props: Prop[];
};

export type Env = { typescript: boolean; svelte5: boolean };

export type ComponentSource = { file: string; source: string };

export const ICON_DIR = 'src/feega/icons';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const INDENT = '  ';

export const pascalOf = (iconName: string): string =>
  iconName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');

export const componentName = (iconName: string): string => `${/^\d/.test(pascalOf(iconName)) ? 'Icon' : ''}${pascalOf(iconName)}Icon`;

const quoted = (value: number | string) => (typeof value === 'number' ? String(value) : `'${value}'`);

const camel = (attribute: string) => attribute.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

const defaultsOf = (props: Prop[]) => props.map((prop) => `${prop.name} = ${quoted(prop.fallback)}`).join(', ');

const typeOf = (prop: Prop) => (typeof prop.fallback === 'number' ? 'number' : 'string');

type Attribute = { name: string; value: string; bound: boolean };

const attributesOfSvg = (spec: SvgSpec): Attribute[] => [
  { name: 'xmlns', value: SVG_NAMESPACE, bound: false },
  { name: 'viewBox', value: spec.viewBox, bound: false },
  ...Object.entries(spec.fixed).map(([name, value]) => ({ name, value, bound: false })),
  ...Object.entries(spec.bound).map(([name, value]) => ({ name, value, bound: true }))
];

const braced = (name: (attribute: string) => string) => (attribute: Attribute) => (attribute.bound ? `${name(attribute.name)}={${attribute.value}}` : `${name(attribute.name)}="${attribute.value}"`);

const vueAttribute = (attribute: Attribute) => (attribute.bound ? `:${attribute.name}="${attribute.value}"` : `${attribute.name}="${attribute.value}"`);

const svgTag = (spec: SvgSpec, write: (attribute: Attribute) => string, rest: string) => `<svg ${[...attributesOfSvg(spec).map(write), rest].filter(Boolean).join(' ')}>${spec.body}</svg>`;

const svelte = (spec: SvgSpec, env: Env): string => {
  const script = env.svelte5
    ? `let { ${defaultsOf(spec.props)}, ...rest } = $props();`
    : spec.props.map((prop) => `export let ${prop.name} = ${quoted(prop.fallback)};`).join(`\n${INDENT}`);
  const rest = env.svelte5 ? '{...rest}' : '{...$$restProps}';

  return `<script${env.typescript ? ' lang="ts"' : ''}>\n${INDENT}${script}\n</script>\n\n${svgTag(spec, braced((name) => name), rest)}\n`;
};

const react = (spec: SvgSpec, env: Env): string => {
  const own = spec.props.map((prop) => `${prop.name}?: ${typeOf(prop)}`).join('; ');
  const types = env.typescript ? `import type { SVGProps } from 'react';\n\ntype Own = { ${own} };\n\n` : '';
  const annotation = env.typescript ? ': Omit<SVGProps<SVGSVGElement>, keyof Own> & Own' : '';

  return `${types}export default function ${spec.name}({ ${defaultsOf(spec.props)}, ...rest }${annotation}) {\n${INDENT}return ${svgTag(spec, braced(camel), '{...rest}')};\n}\n`;
};

const vue = (spec: SvgSpec): string => {
  const props = spec.props.map((prop) => `${INDENT}${prop.name}: { type: ${typeOf(prop) === 'number' ? 'Number' : 'String'}, default: ${quoted(prop.fallback)} }`).join(',\n');

  return `<script setup>\ndefineProps({\n${props}\n});\n</script>\n\n<template>\n${INDENT}${svgTag(spec, vueAttribute, '')}\n</template>\n`;
};

const astro = (spec: SvgSpec): string => `---\nconst { ${defaultsOf(spec.props)}, ...rest } = Astro.props;\n---\n\n${svgTag(spec, braced((name) => name), '{...rest}')}\n`;

type Build = (spec: SvgSpec, env: Env) => ComponentSource;

const BUILDS: Record<Framework, Build> = {
  [Framework.Svelte]: (spec, env) => ({ file: `${ICON_DIR}/${spec.name}.svelte`, source: svelte(spec, env) }),
  [Framework.React]: (spec, env) => ({ file: `${ICON_DIR}/${spec.name}.${env.typescript ? 'tsx' : 'jsx'}`, source: react(spec, env) }),
  [Framework.Vue]: (spec) => ({ file: `${ICON_DIR}/${spec.name}.vue`, source: vue(spec) }),
  [Framework.Astro]: (spec) => ({ file: `${ICON_DIR}/${spec.name}.astro`, source: astro(spec) })
};

export const svgComponent = (spec: SvgSpec, framework: Framework, env: Env): ComponentSource => BUILDS[framework](spec, env);

export function attributesOf(framework: Framework, props: Prop[], values: Record<string, number | string>): string {
  const changed = props.filter((prop) => values[prop.name] !== undefined && values[prop.name] !== prop.fallback);

  return changed
    .map((prop) => {
      const value = values[prop.name];
      if (typeof value === 'string') {
        return `${prop.name}="${value}"`;
      }
      return framework === Framework.Vue ? `:${prop.name}="${value}"` : `${prop.name}={${value}}`;
    })
    .join(' ');
}
