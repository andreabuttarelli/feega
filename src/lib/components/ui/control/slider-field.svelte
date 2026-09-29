<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { CONTROL_HEIGHT, MIXED_TEXT, type ControlProps } from "./types";

	let { label, value, mixed = false, min = 0, max = 100, step = 1, disabled = false, onchange }: ControlProps = $props();

	const shown = $derived(typeof value === "number" ? value : min);
</script>

<div class="flex w-full min-w-0 items-center gap-2" data-slot="slider-field">
	<input
		type="range"
		aria-label={label}
		{min}
		{max}
		{step}
		{disabled}
		value={shown}
		class="h-1 min-w-0 flex-1 cursor-pointer appearance-none bg-line-2 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-foreground"
		oninput={(e) => onchange(Number(e.currentTarget.value))}
	/>
	<input
		type="number"
		aria-label={`${label} value`}
		{min}
		{max}
		{step}
		{disabled}
		value={mixed ? "" : shown}
		placeholder={mixed ? MIXED_TEXT : undefined}
		class={cn(CONTROL_HEIGHT, "w-16 shrink-0 border border-line-2 bg-background px-2 text-right text-xs tabular-nums outline-none focus-visible:border-ring")}
		onchange={(e) => onchange(Number(e.currentTarget.value))}
	/>
</div>
