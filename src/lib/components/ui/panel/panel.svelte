<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils.js";

	let {
		title,
		description,
		actions,
		class: className,
		children,
	}: {
		title?: string;
		description?: string;
		actions?: Snippet;
		class?: string;
		children?: Snippet;
	} = $props();
</script>

<section data-slot="panel" class={cn("mb-4 overflow-hidden rounded-md bg-ui-sunken text-ui-text", className)}>
	{#if title || actions}
		<header class="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
			<div class="flex min-w-0 flex-col gap-0.5">
				{#if title}
					<h2 class="m-0 text-ui-title font-semibold tracking-[var(--ui-tracking-title)] text-ui-text">{title}</h2>
				{/if}
				{#if description}
					<p class="m-0 text-ui-label text-ui-text-3">{description}</p>
				{/if}
			</div>
			{@render actions?.()}
		</header>
	{/if}
	<div class="divide-y divide-ui-divider [&>*]:px-5 [&>*]:py-4">
		{@render children?.()}
	</div>
</section>
