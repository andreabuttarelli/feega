<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		inset?: boolean;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="dropdown-menu-label"
	data-inset={inset}
	class={cn("px-2 pt-2 pb-1 text-ui-section font-semibold uppercase tracking-[var(--ui-tracking-caps)] text-ui-text-3 data-inset:pl-7 data-[inset]:pl-8", className)}
	{...restProps}
>
	{@render children?.()}
</div>
