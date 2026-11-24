import { Framework } from '@feega/plugin-api/protocol';

export enum Stack {
  React = 'react',
  Next = 'next',
  Astro = 'astro',
  AstroWithoutReact = 'astro-without-react',
  Vue = 'vue',
  Svelte = 'svelte'
}

export type Plan = { ok: true; clientDirective: boolean; attributes: string } | { ok: false; reason: string };

export type Packages = Record<string, string>;

const NEXT = 'next';
const ASTRO_REACT = '@astrojs/react';
const REACT = 'react';
const PACKAGE = '@shadergradient/react';
const PACKAGE_VERSION = '^2.4.20';

const PLANS: Record<Stack, Plan> = {
  [Stack.React]: { ok: true, clientDirective: false, attributes: '' },
  [Stack.Next]: { ok: true, clientDirective: true, attributes: '' },
  [Stack.Astro]: { ok: true, clientDirective: false, attributes: 'client:only="react"' },
  [Stack.AstroWithoutReact]: { ok: false, reason: 'ShaderGradient needs the @astrojs/react integration in Astro. Add it first.' },
  [Stack.Vue]: { ok: false, reason: 'ShaderGradient is React only here. Vue and Nuxt are not supported yet.' },
  [Stack.Svelte]: { ok: false, reason: 'ShaderGradient has no Svelte build. Svelte and SvelteKit are not supported.' }
};

const REACT_LINES: Record<number, { fiber: string; three: string }> = {
  18: { fiber: '^8.17.10', three: '^0.169.0' },
  19: { fiber: '^9.0.0', three: '^0.169.0' }
};

const UNSUPPORTED_REACT = 'ShaderGradient needs React 18 or 19 in your app.';

export function stackOf(framework: Framework, packages: Packages): Stack {
  if (framework === Framework.Vue) {
    return Stack.Vue;
  }
  if (framework === Framework.Svelte) {
    return Stack.Svelte;
  }
  if (framework === Framework.Astro) {
    return ASTRO_REACT in packages ? Stack.Astro : Stack.AstroWithoutReact;
  }
  return NEXT in packages ? Stack.Next : Stack.React;
}

export const planFor = (stack: Stack): Plan => PLANS[stack];

export type Missing = { name: string; version: string };

export type Dependencies = { ok: true; missing: Missing[] } | { ok: false; reason: string };

export function dependenciesFor(packages: Packages): Dependencies {
  const major = Number(packages[REACT]?.match(/\d+/)?.[0]);
  const line = REACT_LINES[major];
  if (!line) {
    return { ok: false, reason: UNSUPPORTED_REACT };
  }
  const wanted: Missing[] = [
    { name: PACKAGE, version: PACKAGE_VERSION },
    { name: '@react-three/fiber', version: line.fiber },
    { name: 'three', version: line.three }
  ];
  return { ok: true, missing: wanted.filter((one) => !(one.name in packages)) };
}
