<script lang="ts">
	import { LoaderCircle } from "@lucide/svelte";
	import { cn } from "$lib/utils.js";

	let { label, class: className }: { label: string; class?: string } = $props();
</script>

<span data-slot="spinner" role="status" class={cn("inline-flex items-center text-muted-foreground", className)}>
	<LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
	<span class="sr-only">{label}</span>
</span>
