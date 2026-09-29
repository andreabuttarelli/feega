<script lang="ts" module>
	export const ControlLayout = { Inline: "inline", Stack: "stack" } as const;
	export type ControlLayout = (typeof ControlLayout)[keyof typeof ControlLayout];
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils.js";
	import { CONTROL_ROW } from "./types";

	let {
		label,
		hint,
		layout = ControlLayout.Stack,
		control,
		children
	}: {
		label: string;
		hint?: string;
		layout?: ControlLayout;
		control?: string;
		children?: Snippet;
	} = $props();
</script>

<div
	data-slot="control-row"
	data-control={control}
	class={cn(
		"flex min-w-0 gap-1.5 px-3 py-1.5",
		layout === ControlLayout.Inline ? cn(CONTROL_ROW, "items-center justify-between gap-3") : "flex-col"
	)}
>
	<div class="flex min-w-0 flex-col">
		<span class="text-xs font-medium text-foreground">{label}</span>
		{#if hint}
			<span class="text-[0.6875rem] leading-snug text-muted-foreground">{hint}</span>
		{/if}
	</div>
	{@render children?.()}
</div>
