import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { PropKind } from './component-props.ts';
import { svelteControlsOf } from './svelte-props.ts';

const compiler = { parse };
const controls = (script: string, lang = 'ts') => svelteControlsOf(`<script lang="${lang}">\n${script}\n</script>\n<p>x</p>\n`, compiler);

describe('svelteControlsOf', () => {
  it('reads the annotated destructuring of $props', () => {
    expect(controls('let { name, count = 2, featured }: { name: string; count?: number; featured: boolean } = $props();')).toEqual([
      { name: 'name', kind: PropKind.Text, required: true },
      { name: 'count', kind: PropKind.Number, required: false, default: 2 },
      { name: 'featured', kind: PropKind.Toggle, required: true }
    ]);
  });

  it('turns a union of strings into a select and follows a Props interface', () => {
    expect(controls("interface Props { size?: 'sm' | 'lg'; label: string }\nlet { size = 'sm', label }: Props = $props();")).toEqual([
      { name: 'size', kind: PropKind.Select, required: false, options: ['sm', 'lg'], default: 'sm' },
      { name: 'label', kind: PropKind.Text, required: true }
    ]);
  });

  it('guesses from defaults when there is no type', () => {
    expect(controls("let { title = 'Hi', big = false, n } = $props();", 'js')).toEqual([
      { name: 'title', kind: PropKind.Text, required: false, default: 'Hi' },
      { name: 'big', kind: PropKind.Toggle, required: false, default: false },
      { name: 'n', kind: PropKind.Text, required: true }
    ]);
  });

  it('leaves out snippets as children and what it cannot control', () => {
    expect(controls("import type { Snippet } from 'svelte';\nlet { children, items }: { children: Snippet; items: string[] } = $props();")!.map((c) => c.kind)).toEqual([PropKind.Children]);
  });

  it('answers null when the component has no $props', () => {
    expect(controls('let a = 1;')).toBeNull();
  });

  it('answers null for a file it cannot parse', () => {
    expect(svelteControlsOf('<script>let {</script>', compiler)).toBeNull();
  });
});
