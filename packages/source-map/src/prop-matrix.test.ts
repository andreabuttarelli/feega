import { createRequire } from 'node:module';
import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { astroControlsOf } from './astro-props.ts';
import { controlsOf } from './component-props.ts';
import { PropKind, type PropControl } from './prop-model.ts';
import { svelteControlsOf } from './svelte-props.ts';
import { vueControlsOf } from './vue-props.ts';

const vueCompiler = createRequire(import.meta.url)('@vue/compiler-sfc');

type Source = { decls?: string; type: string; name?: string; optional?: boolean };
type Framework = { name: string; node: string | null; read: (source: Source) => PropControl | undefined };

const field = ({ type, name = 'value', optional }: Source) => `${name}${optional ? '?' : ''}: ${type}`;
const pick = (controls: PropControl[] | null, name = 'value') => controls?.find((control) => control.name === name);

const FRAMEWORKS: Framework[] = [
  {
    name: 'React',
    node: 'ReactNode',
    read: (source) => pick(controlsOf(`${source.decls ?? ''}\ntype Props = { ${field(source)} };\nexport function Thing({ ${source.name ?? 'value'} }: Props) { return <i />; }`, 'Thing.tsx', 'Thing'), source.name)
  },
  {
    name: 'Vue',
    node: 'VNode',
    read: (source) => pick(vueControlsOf(`<script setup lang="ts">\n${source.decls ?? ''}\ndefineProps<{ ${field(source)} }>();\n</script>\n<template><div /></template>`, 'Thing.vue', vueCompiler), source.name)
  },
  {
    name: 'Svelte',
    node: 'Snippet',
    read: (source) => pick(svelteControlsOf(`<script lang="ts">\n${source.decls ?? ''}\nlet { ${source.name ?? 'value'} }: { ${field(source)} } = $props();\n</script>\n<p>x</p>`, { parse }), source.name)
  },
  {
    name: 'Astro',
    node: null,
    read: (source) => pick(astroControlsOf(`---\n${source.decls ?? ''}\ninterface Props { ${field(source)} }\nconst { ${source.name ?? 'value'} } = Astro.props;\n---\n<p />`), source.name)
  }
];

const SIZE = "type Size = 'sm' | 'lg';";
const ITEM = 'interface Item { id: number }';

type Case = { label: string; source: Source; expected: Partial<PropControl> };

const CASES: Case[] = [
  { label: 'string', source: { type: 'string' }, expected: { kind: PropKind.Text } },
  { label: 'number', source: { type: 'number' }, expected: { kind: PropKind.Number } },
  { label: 'boolean', source: { type: 'boolean' }, expected: { kind: PropKind.Toggle } },
  { label: 'a union of strings', source: { type: "'a' | 'b'" }, expected: { kind: PropKind.Select, options: ['a', 'b'] } },
  { label: 'a union of numbers', source: { type: '1 | 2 | 3' }, expected: { kind: PropKind.Select, options: [1, 2, 3] } },
  { label: 'a union of mixed literals', source: { type: "'auto' | 2 | true" }, expected: { kind: PropKind.Select, options: ['auto', 2, true] } },
  { label: 'an optional union with undefined', source: { type: "'a' | 'b' | undefined", optional: true }, expected: { kind: PropKind.Select, options: ['a', 'b'], required: false } },
  { label: 'a union declared as an alias', source: { decls: SIZE, type: 'Size' }, expected: { kind: PropKind.Select, options: ['sm', 'lg'] } },
  { label: 'a string or a number', source: { type: 'string | number' }, expected: { kind: PropKind.Text } },
  { label: 'literals widened by string', source: { type: "'a' | string" }, expected: { kind: PropKind.Text } },
  { label: 'an array', source: { type: 'string[]' }, expected: { kind: PropKind.Array } },
  { label: 'a generic array', source: { type: 'Array<number>' }, expected: { kind: PropKind.Array } },
  { label: 'an array of declared items', source: { decls: ITEM, type: 'Item[]' }, expected: { kind: PropKind.Array } },
  { label: 'a tuple', source: { type: '[number, number]' }, expected: { kind: PropKind.Array } },
  { label: 'an object literal type', source: { type: '{ a: string }' }, expected: { kind: PropKind.Object } },
  { label: 'a record', source: { type: 'Record<string, number>' }, expected: { kind: PropKind.Object } },
  { label: 'object', source: { type: 'object' }, expected: { kind: PropKind.Object } },
  { label: 'a declared interface', source: { decls: ITEM, type: 'Item' }, expected: { kind: PropKind.Object } },
  { label: 'a callback', source: { type: '() => void' }, expected: { kind: PropKind.Callback } },
  { label: 'a callback with arguments', source: { type: '(id: number) => string' }, expected: { kind: PropKind.Callback } },
  { label: 'an optional callback', source: { type: '() => void', optional: true }, expected: { kind: PropKind.Callback, required: false } },
  { label: 'a date', source: { type: 'Date' }, expected: { kind: PropKind.Date } },
  { label: 'a color by name', source: { name: 'color', type: 'string' }, expected: { kind: PropKind.Color } },
  { label: 'a background by name', source: { name: 'background', type: 'string' }, expected: { kind: PropKind.Color } },
  { label: 'a required prop', source: { type: 'string' }, expected: { required: true } }
];

describe.each(FRAMEWORKS)('$name props', (framework) => {
  it.each(CASES)('reads $label', ({ source, expected }) => {
    expect(framework.read(source)).toMatchObject(expected);
  });

  it('reads a slot or node type as children', () => {
    if (!framework.node) {
      return;
    }

    expect(framework.read({ type: framework.node })).toMatchObject({ kind: PropKind.Children });
    expect(framework.read({ type: `string | ${framework.node}` })).toMatchObject({ kind: PropKind.Children });
  });
});
