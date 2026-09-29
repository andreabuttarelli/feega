<script lang="ts">
	import { ChevronDown } from "@lucide/svelte";
	import type { HTMLSelectAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLSelectAttributes> = $props();
</script>

<span data-slot="select" class={cn("relative inline-flex w-full min-w-0", className)}>
	<select
		bind:this={ref}
		bind:value
		class="h-9 w-full min-w-0 appearance-none border border-input bg-background pr-8 pl-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
		{...restProps}
	>
		{@render children?.()}
	</select>
	<ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
</span>
