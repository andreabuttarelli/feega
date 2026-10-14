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
		class="h-8 w-full min-w-0 appearance-none rounded-sm border-0 bg-ui-input pr-8 pl-2.5 text-ui-body text-ui-text outline-none transition-colors duration-(--ui-dur-fast) hover:bg-ui-input-hover focus-visible:shadow-[var(--ui-ring)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-[0_0_0_2px_var(--ui-danger)] pointer-coarse:h-11"
		{...restProps}
	>
		{@render children?.()}
	</select>
	<ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ui-icon" aria-hidden="true" />
</span>
