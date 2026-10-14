<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from "$lib/utils.js";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		"data-slot": dataSlot = "textarea",
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<textarea
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		"flex field-sizing-content min-h-16 w-full min-w-0 rounded-sm border-0 bg-ui-input px-2.5 py-2 text-base md:text-ui-body text-ui-text outline-none transition-colors duration-(--ui-dur-fast) placeholder:text-ui-text-3 hover:bg-ui-input-hover focus-visible:bg-ui-panel focus-visible:shadow-[var(--ui-ring)] aria-invalid:shadow-[0_0_0_2px_var(--ui-danger)] disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	bind:value
	{...restProps}></textarea>
