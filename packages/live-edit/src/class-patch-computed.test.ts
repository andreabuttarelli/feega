import { describe, expect, it } from 'vitest';
import { stylePatch } from './class-patch';
import { LiveProp } from './live-fields';

const NOT_WRITTEN = 'class is not a literal, not written';

async function patched(file: string, open: string, value = 'red-500') {
  const out = await stylePatch(async () => `${open}\n`, { file, line: 1, col: 1 }, { prop: LiveProp.Fill, value });
  return { after: out.files[0]?.after.trimEnd(), skipped: out.skipped };
}

describe('computed class in React', () => {
  it.each([
    ['<span className={cn("px-4 py-2", cond && "x")}>', '<span className={cn("px-4 py-2 bg-red-500", cond && "x")}>'],
    ["<span className={clsx('a', b)}>", "<span className={clsx('a bg-red-500', b)}>"],
    ['<span className={cva("base p-2", { variants: {} })}>', '<span className={cva("base p-2 bg-red-500", { variants: {} })}>'],
    ['<span className={cn("bg-white p-2", cond && "x")}>', '<span className={cn("bg-red-500 p-2", cond && "x")}>'],
    ['<span className={cn(cond && "x", "px-4")}>', '<span className={cn(cond && "x", "px-4 bg-red-500")}>'],
    ['<span className={`px-4 ${size}`}>', '<span className={`px-4 bg-red-500 ${size}`}>'],
    ['<span className={`px-4`}>', '<span className={`px-4 bg-red-500`}>'],
    ['<span className={"px-4"}>', '<span className={"px-4 bg-red-500"}>']
  ])('%s', async (open, expected) => {
    expect((await patched('src/Tag.tsx', open)).after).toBe(expected);
  });

  it.each([
    ['<span className={cond ? "a" : "b"}>'],
    ['<span className={cn(cond && "x", props.className)}>'],
    ['<span className={`btn-${size}`}>'],
    ['<span className={cn({ "px-4": cond })}>'],
    ['<span className={styles.card}>'],
    ['<span className={className}>']
  ])('refuses %s with the clear message', async (open) => {
    const out = await patched('src/Tag.tsx', open);

    expect(out.after).toBeUndefined();
    expect(out.skipped).toEqual([`src/Tag.tsx:1: ${NOT_WRITTEN}`]);
  });

  it('refuses a value that would break out of the literal', async () => {
    const out = await patched('src/Tag.tsx', '<span className={cn("px-4", x)}>', '[url("a")]');

    expect(out.after).toBeUndefined();
    expect(out.skipped).toHaveLength(1);
  });
});

describe('computed class in Vue', () => {
  it('edits the static string inside a :class array', async () => {
    expect((await patched('src/Tag.vue', `<div :class="['px-4', { on: active }]">`)).after).toBe(`<div :class="['px-4 bg-red-500', { on: active }]">`);
  });

  it('edits the static string of v-bind:class with double quotes in single-quoted attribute', async () => {
    expect((await patched('src/Tag.vue', `<div v-bind:class='["px-4", b]'>`)).after).toBe(`<div v-bind:class='["px-4 bg-red-500", b]'>`);
  });

  it('adds a static class next to an object with no static string', async () => {
    expect((await patched('src/Tag.vue', '<div :class="{ on: active }">')).after).toBe('<div :class="{ on: active }" class="bg-red-500">');
  });

  it('adds a static class next to an object whose keys are the only strings', async () => {
    expect((await patched('src/Tag.vue', `<div :class="{ 'px-4': active }">`)).after).toBe(`<div :class="{ 'px-4': active }" class="bg-red-500">`);
  });
});

describe('computed class in Svelte', () => {
  it('edits the static string inside class={...}', async () => {
    expect((await patched('src/Tag.svelte', '<div class={cn("p-2", x)}>')).after).toBe('<div class={cn("p-2 bg-red-500", x)}>');
  });

  it('edits the static part before an interpolation', async () => {
    expect((await patched('src/Tag.svelte', '<div class="p-2 {x}">')).after).toBe('<div class="p-2 bg-red-500 {x}">');
  });

  it('refuses a class that starts inside an interpolation', async () => {
    const out = await patched('src/Tag.svelte', '<div class={x}>');

    expect(out.skipped).toEqual([`src/Tag.svelte:1: ${NOT_WRITTEN}`]);
  });

  it('keeps a class: directive and adds the static class', async () => {
    expect((await patched('src/Tag.svelte', '<div class:active={on}>')).after).toBe('<div class:active={on} class="bg-red-500">');
  });
});
