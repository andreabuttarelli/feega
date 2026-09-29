<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils.js";
	import { CONTROL_HEIGHT, nextIndex, type ControlOption, type ControlProps } from "./types";

	let {
		label,
		value,
		options = [],
		disabled = false,
		onchange,
		glyph
	}: ControlProps & { glyph?: Snippet<[ControlOption]> } = $props();

	let buttons = $state<HTMLButtonElement[]>([]);

	const selected = $derived(options.findIndex((o) => o.value === String(value)));
	const focusable = $derived(selected < 0 ? 0 : selected);

	function keydown(event: KeyboardEvent, index: number) {
		const next = nextIndex(index, event.key, options.length);
		if (next === null) {
			return;
		}
		event.preventDefault();
		buttons[next]?.focus();
		onchange(options[next].value);
	}
</script>

<div role="radiogroup" aria-label={label} data-slot="segmented" class="flex w-full min-w-0 flex-wrap gap-px border border-line-2 bg-line-2">
	{#each options as option, i (option.value)}
		<button
			bind:this={buttons[i]}
			type="button"
			role="radio"
			aria-checked={i === selected}
			tabindex={i === focusable ? 0 : -1}
			{disabled}
			class={cn(
				CONTROL_HEIGHT,
				"inline-flex min-w-12 flex-1 items-center justify-center gap-1.5 bg-background px-2 text-xs font-medium tabular-nums text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:opacity-50",
				i === selected && "bg-foreground text-background hover:text-background"
			)}
			onclick={() => onchange(option.value)}
			onkeydown={(e) => keydown(e, i)}
		>
			{#if glyph}{@render glyph(option)}{/if}
			{option.label}
		</button>
	{/each}
</div>
