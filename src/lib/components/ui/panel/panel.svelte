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

<section data-slot="panel" class={cn("mb-4 border border-border bg-background", className)}>
	{#if title || actions}
		<header class="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
			<div class="flex min-w-0 flex-col gap-0.5">
				{#if title}
					<h2 class="m-0 text-sm font-semibold tracking-tight text-foreground">{title}</h2>
				{/if}
				{#if description}
					<p class="m-0 text-[0.8125rem] text-muted-foreground">{description}</p>
				{/if}
			</div>
			{@render actions?.()}
		</header>
	{/if}
	<div class="divide-y divide-border [&>*]:px-5 [&>*]:py-4">
		{@render children?.()}
	</div>
</section>
