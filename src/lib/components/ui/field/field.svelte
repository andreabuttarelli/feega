<script lang="ts" module>
	import { tv } from "tailwind-variants";

	export const FieldLayout = { Stack: "stack", Row: "row" } as const;
	export type FieldLayout = (typeof FieldLayout)[keyof typeof FieldLayout];

	export const fieldVariants = tv({
		slots: {
			root: "flex min-w-0 gap-2",
			text: "flex min-w-0 flex-col gap-1",
			label: "text-sm font-semibold text-foreground",
			hint: "max-w-[60ch] text-[0.8125rem] leading-snug text-muted-foreground",
			error: "text-[0.8125rem] text-destructive",
			control: "flex min-w-0 flex-col gap-2",
		},
		variants: {
			layout: {
				stack: { root: "flex-col" },
				row: { root: "flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6", control: "sm:shrink-0 sm:items-end" },
			},
		},
		defaultVariants: { layout: "stack" },
	});
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils.js";

	let {
		label,
		hint,
		error,
		for: htmlFor,
		layout = FieldLayout.Stack,
		class: className,
		children,
	}: {
		label: string;
		hint?: string;
		error?: string | null;
		for?: string;
		layout?: FieldLayout;
		class?: string;
		children?: Snippet;
	} = $props();

	const styles = $derived(fieldVariants({ layout }));
</script>

<div data-slot="field" class={cn(styles.root(), className)}>
	<div class={styles.text()}>
		{#if htmlFor}
			<label class={styles.label()} for={htmlFor}>{label}</label>
		{:else}
			<span class={styles.label()}>{label}</span>
		{/if}
		{#if hint}
			<p class={styles.hint()}>{hint}</p>
		{/if}
	</div>
	<div class={styles.control()}>
		{@render children?.()}
		{#if error}
			<p class={styles.error()} role="alert">{error}</p>
		{/if}
	</div>
</div>
