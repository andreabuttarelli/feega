import { describe, expect, it } from 'vitest';
import { AxisSource, cellsOf, discover, discoverIn, ExportKind, libraryFiles, type DiscoveredComponent } from './component-discovery';

const SHADCN_BUTTON = `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background shadow-xs",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
`;

const TV_CHIP = `import { tv, type VariantProps } from 'tailwind-variants';

const chip = tv({
  base: 'rounded-full px-2',
  variants: {
    color: { primary: 'bg-blue-500', danger: 'bg-red-500' },
    disabled: { true: 'opacity-50' }
  },
  defaultVariants: { color: 'primary' }
});

type ChipProps = VariantProps<typeof chip> & { label: string };

export default function Chip({ color, disabled, label }: ChipProps) {
  return <span className={chip({ color, disabled })}>{label}</span>;
}
`;

const UNION_ALERT = `type Tone = 'neutral' | 'critical';

enum Size {
  Small = 'small',
  Large = 'large'
}

type AlertProps = {
  tone?: Tone;
  type: 'inline' | 'banner';
  level?: 1 | 2 | 3;
  size?: Size;
  loading?: boolean;
  title: string;
  children?: React.ReactNode;
  onClose?: () => void;
};

export const Alert = ({ tone = 'neutral', type, level = 1, size, loading = false, title, children }: AlertProps) => (
  <div role="alert">{title}{children}</div>
);
`;

const CALLOUT = `<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		type = 'info',
		title,
		children
	}: {
		type?: 'info' | 'warning' | 'success' | 'danger';
		title?: string;
		children: Snippet;
	} = $props();
</script>

<aside class="border-l-2 border-primary pl-4 my-6">
	{#if title}<p>{title}</p>{/if}
	{@render children()}
</aside>
`;

const BADGE = `<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'category' | 'tag';
		href?: string;
		children: Snippet;
	}

	let { variant = 'default', href, children }: Props = $props();
</script>

{#if href}<a {href}>{@render children()}</a>{:else}<span>{@render children()}</span>{/if}
`;

const SVELTE4_PILL = `<script context="module" lang="ts">
	export const prerender = true;
</script>

<script lang="ts">
	export let tone: 'soft' | 'loud' = 'soft';
	export let open = false;
	export let label: string;
</script>

<span class:open>{label}</span>
`;

const VUE_TAG = `<script setup lang="ts">
const props = withDefaults(defineProps<{
  kind?: 'info' | 'warn'
  closable?: boolean
  text: string
}>(), { kind: 'info', closable: false })
</script>

<template><span>{{ text }}</span></template>
`;

const VUE_RUNTIME = `<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  variant: { type: String as PropType<'solid' | 'ghost'>, default: 'solid' },
  disabled: Boolean,
  label: String
})
</script>

<template><button>{{ label }}</button></template>
`;

const STORY = `import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta = {
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['default', 'outline', 'brand'] },
    elevation: { options: ['flat', 'raised'] }
  },
  args: { variant: 'default' }
} satisfies Meta<typeof Button>;

export default meta;
export const Primary: StoryObj<typeof meta> = { args: { variant: 'outline' } };
`;

const named = (found: DiscoveredComponent[], name: string) => found.find((c) => c.name === name)!;

const axisValues = (c: DiscoveredComponent) => Object.fromEntries(Object.entries(c.axes).map(([k, a]) => [k, a.values]));

describe('discover', () => {
  it('il button di shadcn: variant × size dal cva, con i default, esportato come forwardRef', () => {
    const button = named(discover({ 'components/ui/button.tsx': SHADCN_BUTTON }).components, 'Button');

    expect(axisValues(button)).toEqual({
      variant: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      size: ['default', 'sm', 'lg', 'icon'],
      asChild: ['false', 'true']
    });
    expect(button.axes.variant.default).toBe('default');
    expect(button.axes.variant.evidence).toEqual([AxisSource.Cva]);
    expect(button.axes.asChild.evidence).toEqual([AxisSource.Boolean]);
    expect(button.exported).toBe(ExportKind.Named);
    expect(button.file).toBe('components/ui/button.tsx');
  });

  it('il cva dichiarato in un file accanto si legge con un salto di import relativo', () => {
    const files = {
      'components/ui/button.tsx': `import { buttonVariants, type ButtonVariants } from './button-variants';\nexport function Button({ variant }: ButtonVariants) { return <button className={buttonVariants({ variant })} />; }`,
      'components/ui/button-variants.ts': `import { cva, type VariantProps } from 'class-variance-authority';\nexport const buttonVariants = cva('', { variants: { variant: { solid: '', soft: '' } } });\nexport type ButtonVariants = VariantProps<typeof buttonVariants>;`
    };

    expect(axisValues(named(discover(files).components, 'Button'))).toEqual({ variant: ['solid', 'soft'] });
  });

  it('un componente tv, export default: assi dal tv, il testo resta testo', () => {
    const chip = named(discover({ 'src/components/Chip.tsx': TV_CHIP }).components, 'Chip');

    expect(axisValues(chip)).toEqual({ color: ['primary', 'danger'], disabled: ['false', 'true'] });
    expect(chip.axes.color.evidence).toEqual([AxisSource.Tv]);
    expect(chip.axes.color.default).toBe('primary');
    expect(chip.texts).toEqual(['label']);
    expect(chip.exported).toBe(ExportKind.Default);
  });

  it('props a unione, enum, numeri dichiarati e booleani; type resta un asse; gli handler no', () => {
    const alert = named(discover({ 'src/components/Alert.tsx': UNION_ALERT }).components, 'Alert');

    expect(axisValues(alert)).toEqual({ tone: ['neutral', 'critical'], type: ['inline', 'banner'], level: ['1', '2', '3'], size: ['small', 'large'], loading: ['false', 'true'] });
    expect(alert.axes.tone.default).toBe('neutral');
    expect(alert.axes.level.default).toBe('1');
    expect(alert.axes.size.evidence).toEqual([AxisSource.Enum]);
    expect(alert.texts).toEqual(['title', 'children']);
    expect(alert.states).toEqual(['loading']);
  });

  it('un tipo importato da un pacchetto o da un alias non si indovina: asse non risolto', () => {
    const source = `import type { Size } from '$lib/types';\nexport function Box({ size }: { size: Size }) { return <div />; }`;
    const box = named(discover({ 'src/components/Box.tsx': source }).components, 'Box');

    expect(box.axes).toEqual({});
    expect(box.unresolved).toEqual(['size']);
  });

  it('una funzione con la maiuscola che non rende JSX non è un componente', () => {
    expect(discover({ 'src/components/format.ts': 'export function Format(x: string) { return x.trim(); }' }).components).toEqual([]);
  });

  it('Callout di Svelte 5: type a quattro valori dai tipi di $props(), il default dalla destrutturazione', () => {
    const callout = named(discover({ 'src/lib/components/ui/Callout.svelte': CALLOUT }).components, 'Callout');

    expect(axisValues(callout)).toEqual({ type: ['info', 'warning', 'success', 'danger'] });
    expect(callout.axes.type.default).toBe('info');
    expect(callout.texts).toEqual(['title', 'children']);
    expect(callout.exported).toBe(ExportKind.Default);
  });

  it('Badge di Svelte 5 con interface Props', () => {
    const badge = named(discover({ 'src/lib/components/ui/Badge.svelte': BADGE }).components, 'Badge');

    expect(axisValues(badge)).toEqual({ variant: ['default', 'category', 'tag'] });
    expect(badge.axes.variant.default).toBe('default');
  });

  it('Svelte 4: export let con unione e booleano inferito dal default; lo script di modulo non conta', () => {
    const pill = named(discover({ 'src/lib/components/Pill.svelte': SVELTE4_PILL }).components, 'Pill');

    expect(axisValues(pill)).toEqual({ tone: ['soft', 'loud'], open: ['false', 'true'] });
    expect(pill.axes.tone.default).toBe('soft');
    expect(pill.texts).toEqual(['label']);
    expect(pill.states).toEqual(['open']);
  });

  it('Vue: defineProps tipizzato con withDefaults', () => {
    const tag = named(discover({ 'src/components/Tag.vue': VUE_TAG }).components, 'Tag');

    expect(axisValues(tag)).toEqual({ kind: ['info', 'warn'], closable: ['false', 'true'] });
    expect(tag.axes.kind.default).toBe('info');
    expect(tag.texts).toEqual(['text']);
  });

  it('Vue: defineProps a runtime con PropType', () => {
    const button = named(discover({ 'src/components/VButton.vue': VUE_RUNTIME }).components, 'VButton');

    expect(axisValues(button)).toEqual({ variant: ['solid', 'ghost'], disabled: ['false', 'true'] });
    expect(button.axes.variant.default).toBe('solid');
    expect(button.texts).toEqual(['label']);
  });

  it('una story aggiunge valori e assi come evidenza in più', () => {
    const files = { 'components/ui/button.tsx': SHADCN_BUTTON, 'components/ui/button.stories.tsx': STORY };
    const button = named(discover(files).components, 'Button');

    expect(button.axes.variant.values).toEqual(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'brand']);
    expect(button.axes.variant.evidence).toEqual([AxisSource.Cva, AxisSource.Story]);
    expect(button.axes.elevation).toEqual({ values: ['flat', 'raised'], default: null, evidence: [AxisSource.Story] });
  });
});

describe('libraryFiles', () => {
  const paths = ['src/components/ui/button.tsx', 'src/components/ui/button.test.tsx', 'src/ui/card.tsx', 'src/lib/components/Badge.svelte', 'src/routes/+page.svelte', 'apps/web/components/Nav.vue', 'stories/Button.stories.tsx', 'src/types.d.ts'];

  it('senza components.json legge le cartelle di componenti note e le story', () => {
    expect(libraryFiles(paths, null)).toEqual(['src/components/ui/button.tsx', 'src/lib/components/Badge.svelte', 'apps/web/components/Nav.vue', 'stories/Button.stories.tsx']);
  });

  it('con components.json legge la cartella di aliases.ui', () => {
    expect(libraryFiles(paths, JSON.stringify({ aliases: { ui: '@/ui' } }))).toEqual(['src/ui/card.tsx', 'stories/Button.stories.tsx']);
  });
});

describe('discoverIn', () => {
  it('legge components.json, poi solo i file della libreria', async () => {
    const files: Record<string, string> = { 'components.json': JSON.stringify({ aliases: { ui: '@/components/ui' } }), 'components/ui/button.tsx': SHADCN_BUTTON, 'src/routes/page.tsx': 'export function Page() { return <main />; }' };
    const asked: string[][] = [];
    const read = async (paths: string[]) => {
      asked.push(paths);
      return Object.fromEntries(paths.map((p) => [p, files[p]]));
    };

    const found = await discoverIn(Object.keys(files), read);

    expect(asked).toEqual([['components.json'], ['components/ui/button.tsx']]);
    expect(found.components.map((c) => c.name)).toEqual(['Button']);
  });
});

describe('cellsOf', () => {
  const component = (axes: Record<string, string[]>): DiscoveredComponent => ({
    name: 'X',
    file: 'x.tsx',
    exported: ExportKind.Named,
    axes: Object.fromEntries(Object.entries(axes).map(([k, values]) => [k, { values, default: values[0], evidence: [AxisSource.Union] }])),
    texts: [],
    states: [],
    unresolved: []
  });

  it('il prodotto cartesiano entro 64 celle', () => {
    expect(cellsOf(component({ variant: ['a', 'b'], size: ['s', 'm', 'l'] }))).toHaveLength(6);
  });

  it('oltre 64 celle varia un asse alla volta, gli altri ai default', () => {
    const cells = cellsOf(component({ a: ['1', '2', '3', '4', '5'], b: ['1', '2', '3', '4', '5'], c: ['1', '2', '3'] }));

    expect(cells).toHaveLength(1 + 4 + 4 + 2);
    expect(cells[0]).toEqual({ a: '1', b: '1', c: '1' });
    expect(cells).toContainEqual({ a: '1', b: '5', c: '1' });
  });

  it('un componente senza assi è una cella sola', () => {
    expect(cellsOf(component({}))).toEqual([{}]);
  });
});
