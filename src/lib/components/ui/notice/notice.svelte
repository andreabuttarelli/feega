<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";
	import { TW_MERGE_CONFIG } from "$lib/utils.js";

	export const noticeVariants = tv({
		base: "mb-4 rounded-md px-3.5 py-2.5 text-ui-label leading-snug",
		variants: {
			tone: {
				info: "bg-ui-input text-ui-text",
				success: "bg-success/10 text-success",
				error: "bg-ui-danger/10 text-ui-danger",
			},
		},
		defaultVariants: { tone: "info" },
	}, { twMergeConfig: TW_MERGE_CONFIG });

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
