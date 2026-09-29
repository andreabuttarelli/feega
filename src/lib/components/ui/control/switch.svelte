<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { ControlProps } from "./types";

	let { label, value, mixed = false, disabled = false, onchange }: ControlProps = $props();

	const on = $derived(value === true && !mixed);
</script>

<button
	type="button"
	role="switch"
	aria-checked={mixed ? "mixed" : on}
	aria-label={label}
	{disabled}
	data-slot="switch"
	class={cn(
		"relative inline-flex h-5 w-9 shrink-0 items-center border border-line-2 bg-background outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
		on && "border-foreground bg-foreground"
	)}
	onclick={() => onchange(!on)}
>
	<span
		class={cn(
			"block size-3.5 translate-x-0.5 bg-muted-foreground transition-transform",
			on && "translate-x-4.5 bg-background",
			mixed && "translate-x-2.5"
		)}
	></span>
</button>
