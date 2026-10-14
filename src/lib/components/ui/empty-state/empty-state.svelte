<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils.js";

	let {
		title,
		description,
		icon,
		action,
		class: className,
	}: {
		title: string;
		description?: string;
		icon?: Snippet;
		action?: Snippet;
		class?: string;
	} = $props();
</script>

<div data-slot="empty-state" class={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
	{#if icon}
		<span class="mb-1 flex size-10 items-center justify-center rounded-md bg-ui-input text-ui-icon [&_svg]:size-5">
			{@render icon()}
		</span>
	{/if}
	<p class="m-0 text-ui-title font-semibold text-ui-text">{title}</p>
	{#if description}
		<p class="m-0 max-w-[40ch] text-ui-label leading-snug text-ui-text-3">{description}</p>
	{/if}
	{#if action}
		<div class="mt-2">{@render action()}</div>
	{/if}
</div>
