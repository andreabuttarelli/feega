import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { PropKind } from './component-props.ts';
import { vueControlsOf } from './vue-props.ts';

const compiler = createRequire(import.meta.url)('@vue/compiler-sfc');
const sfc = (script: string) => `<script setup lang="ts">\n${script}\n</script>\n<template><div /></template>\n`;
const controls = (script: string) => vueControlsOf(sfc(script), 'Card.vue', compiler);

describe('vueControlsOf', () => {
  it('reads the type literal of defineProps', () => {
    expect(controls('defineProps<{ name: string; count?: number; featured: boolean }>();')).toEqual([
      { name: 'name', kind: PropKind.Text, required: true },
      { name: 'count', kind: PropKind.Number, required: false },
      { name: 'featured', kind: PropKind.Toggle, required: true }
    ]);
  });

  it('turns a union of strings into a select', () => {
    expect(controls("defineProps<{ size?: 'sm' | 'lg' }>();")).toEqual([{ name: 'size', kind: PropKind.Select, required: false, options: ['sm', 'lg'] }]);
  });

  it('follows an interface declared in the file', () => {
    expect(controls("interface Props { size: 'sm' | 'lg'; label?: string }\nconst props = defineProps<Props>();")).toEqual([
      { name: 'size', kind: PropKind.Select, required: true, options: ['sm', 'lg'] },
      { name: 'label', kind: PropKind.Text, required: false }
    ]);
  });

  it('takes defaults from withDefaults', () => {
    expect(controls("withDefaults(defineProps<{ size?: 'sm' | 'lg'; count?: number }>(), { size: 'lg', count: 3 });")).toEqual([
      { name: 'size', kind: PropKind.Select, required: false, options: ['sm', 'lg'], default: 'lg' },
      { name: 'count', kind: PropKind.Number, required: false, default: 3 }
    ]);
  });

  it('reads the runtime object form', () => {
    expect(controls("defineProps({ title: String, big: { type: Boolean, default: true }, n: Number });")).toEqual([
      { name: 'title', kind: PropKind.Text, required: false },
      { name: 'big', kind: PropKind.Toggle, required: false, default: true },
      { name: 'n', kind: PropKind.Number, required: false }
    ]);
  });

  it('reads the array form as text props', () => {
    expect(controls("defineProps(['name', 'text']);")).toEqual([
      { name: 'name', kind: PropKind.Text, required: false },
      { name: 'text', kind: PropKind.Text, required: false }
    ]);
  });

  it('unwraps factory defaults of withDefaults', () => {
    expect(controls("withDefaults(defineProps<{ items?: string[]; theme?: { a: number } }>(), { items: () => ['x'], theme: () => ({ a: 1 }) });")).toEqual([
      { name: 'items', kind: PropKind.Array, required: false, default: ['x'] },
      { name: 'theme', kind: PropKind.Object, required: false, default: { a: 1 } }
    ]);
  });

  it('reads the constructors of the runtime form', () => {
    expect(controls("defineProps({ items: Array, theme: Object, onPick: Function, when: Date, mixed: [String, Number] });")!.map((c) => [c.name, c.kind])).toEqual([
      ['items', PropKind.Array],
      ['theme', PropKind.Object],
      ['onPick', PropKind.Callback],
      ['when', PropKind.Date],
      ['mixed', PropKind.Text]
    ]);
  });

  it('reads PropType casts and factory defaults of the runtime form', () => {
    const found = controls("defineProps({ size: String as PropType<'sm' | 'lg'>, items: { type: Array, default: () => [1] } });");

    expect(found).toEqual([
      { name: 'size', kind: PropKind.Select, required: false, options: ['sm', 'lg'] },
      { name: 'items', kind: PropKind.Array, required: false, default: [1] }
    ]);
  });

  it('answers null when the component declares no props', () => {
    expect(controls('const a = 1;')).toBeNull();
  });

  it('answers null for a file it cannot parse', () => {
    expect(vueControlsOf('<script setup>defineProps<{', 'Bad.vue', compiler)).toBeNull();
  });
});
