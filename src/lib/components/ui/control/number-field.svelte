<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils.js";
	import { CONTROL_HEIGHT, DEFAULT_TEXT, MIXED_TEXT, type ControlProps } from "./types";

	let { label, value, mixed = false, min, max, step, disabled = false, onchange, action }: ControlProps & { action?: Snippet } = $props();
</script>

<div class="flex w-full min-w-0 items-stretch gap-1" data-slot="number-field">
	<input
		type="number"
		aria-label={label}
		{min}
		{max}
		{step}
		{disabled}
		value={mixed || value === null ? "" : String(value)}
		placeholder={mixed ? MIXED_TEXT : DEFAULT_TEXT}
		class={cn(CONTROL_HEIGHT, "min-w-0 flex-1 border border-line-2 bg-background px-2 text-xs tabular-nums outline-none focus-visible:border-ring")}
		onchange={(e) => onchange(Number(e.currentTarget.value))}
	/>
	{@render action?.()}
</div>
