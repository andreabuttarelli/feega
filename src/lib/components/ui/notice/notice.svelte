<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const noticeVariants = tv({
		base: "mb-4 border px-3.5 py-2.5 text-[0.8125rem] leading-snug",
		variants: {
			tone: {
				info: "border-border bg-muted text-foreground",
				success: "border-success/30 bg-success/10 text-success",
				error: "border-destructive/30 bg-destructive/10 text-destructive",
			},
		},
		defaultVariants: { tone: "info" },
	});

	export type NoticeTone = VariantProps<typeof noticeVariants>["tone"];
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils.js";

	let { tone = "info", class: className, children }: { tone?: NoticeTone; class?: string; children?: Snippet } = $props();
</script>

<p data-slot="notice" role={tone === "error" ? "alert" : "status"} class={cn(noticeVariants({ tone }), className)}>
	{@render children?.()}
</p>
