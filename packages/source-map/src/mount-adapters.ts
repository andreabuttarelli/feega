import { createRequire } from 'node:module';
import { join } from 'node:path';
import { controlsOf, type PropControl } from './component-props.ts';
import { reactModule, svelteModule, vueModule, type MountPage, type MountRequest } from './mount-page.ts';
import { svelteControlsOf } from './svelte-props.ts';
import { vueControlsOf } from './vue-props.ts';

export enum MountFramework {
  React = 'react',
  Vue = 'vue',
  Svelte = 'svelte'
}

export type MountAdapter = {
  module: (request: MountRequest, page: MountPage) => string;
  controls: (code: string, file: string, name: string, root: string) => PropControl[] | null;
  seedsProps: boolean;
};

const projectModule = <T>(root: string, id: string): T | null => {
  try {
    return createRequire(join(root, 'package.json'))(id) as T;
  } catch {
    return null;
  }
};

export const ADAPTERS: Record<MountFramework, MountAdapter> = {
  [MountFramework.React]: { module: reactModule, controls: (code, file, name) => controlsOf(code, file, name), seedsProps: false },
  [MountFramework.Vue]: {
    module: vueModule,
    controls: (code, file, _name, root) => {
      const compiler = projectModule<Parameters<typeof vueControlsOf>[2]>(root, 'vue/compiler-sfc');
      return compiler && vueControlsOf(code, file, compiler);
    },
    seedsProps: false
  },
  [MountFramework.Svelte]: {
    module: svelteModule,
    controls: (code, _file, _name, root) => {
      const compiler = projectModule<Parameters<typeof svelteControlsOf>[1]>(root, 'svelte/compiler');
      return compiler && svelteControlsOf(code, compiler);
    },
    seedsProps: true
  }
};

const BY_EXTENSION: [RegExp, MountFramework][] = [
  [/\.vue$/, MountFramework.Vue],
  [/\.svelte$/, MountFramework.Svelte]
];

export const adapterOf = (file: string): MountAdapter => ADAPTERS[BY_EXTENSION.find(([extension]) => extension.test(file))?.[1] ?? MountFramework.React];

export function seededProps(controls: PropControl[] | null, props: Record<string, unknown>): Record<string, unknown> {
  const seeds = (controls ?? []).flatMap((control) => (control.name in props ? [] : [[control.name, seedOf(control)] as const]));
  return { ...Object.fromEntries(seeds.filter(([, value]) => value !== undefined)), ...props };
}

function seedOf({ name, kind, options, default: fallback }: PropControl): unknown {
  if (fallback !== undefined) {
    return fallback;
  }
  const byKind: Record<string, unknown> = { select: options?.[0], toggle: false, number: 0, text: name };
  return byKind[kind];
}
