<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";
	import { TW_MERGE_CONFIG } from "$lib/utils.js";

	export const badgeVariants = tv({
		base: "h-5 gap-1 rounded-xs border-0 px-1.5 py-0.5 text-xs font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive group/badge inline-flex w-fit shrink-0 items-center justify-center overflow-hidden whitespace-nowrap transition-colors focus-visible:ring-[3px] [&>svg]:pointer-events-none",
		variants: {
			variant: {
				default: "bg-ui-accent-solid text-ui-on-accent [a]:hover:brightness-110",
				secondary: "bg-ui-input text-ui-text-2 [a]:hover:bg-ui-input-hover",
				destructive: "bg-destructive/10 [a]:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 text-destructive dark:bg-destructive/20",
				outline: "shadow-[inset_0_0_0_1px_var(--ui-divider-strong)] text-ui-text [a]:hover:bg-ui-wash",
				ghost: "text-ui-text-2 hover:bg-ui-wash hover:text-ui-text",
				link: "text-primary underline-offset-4 hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}, { twMergeConfig: TW_MERGE_CONFIG });

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import type { HTMLAnchorAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		href,
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAnchorAttributes> & {
		variant?: BadgeVariant;
	} = $props();
</script>

<svelte:element
	this={href ? "a" : "span"}
	bind:this={ref}
	data-slot="badge"
	{href}
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
