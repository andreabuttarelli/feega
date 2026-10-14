<script lang="ts" module>
	import { TW_MERGE_CONFIG, cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";

	export const buttonVariants = tv({
		base: "group/button inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm border-0 font-medium outline-none select-none transition-colors duration-(--ui-dur-fast) focus-visible:shadow-[var(--ui-ring)] aria-invalid:shadow-[0_0_0_2px_var(--ui-danger)] disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--ui-icon-sm)",
		variants: {
			variant: {
				primary: "bg-ui-accent-solid text-ui-on-accent hover:brightness-110 active:brightness-95",
				secondary: "bg-ui-input text-ui-text hover:bg-ui-input-hover active:bg-ui-pressed aria-expanded:bg-ui-pressed",
				ghost: "text-ui-text-2 hover:bg-ui-wash hover:text-ui-text active:bg-ui-pressed aria-expanded:bg-ui-wash aria-expanded:text-ui-text",
				danger: "bg-ui-input text-ui-danger hover:bg-ui-input-hover active:bg-ui-pressed",
				link: "h-auto! px-0! text-ui-text underline underline-offset-4 decoration-ui-divider-strong hover:decoration-current",
			},
			size: {
				sm: "h-7 gap-1.5 px-2.5 text-ui-label",
				md: "h-8 gap-1.5 px-3 text-ui-body",
				lg: "h-9 gap-2 px-4 text-ui-body",
				icon: "size-8 rounded-full",
				"icon-sm": "size-7 rounded-full",
			},
		},
		defaultVariants: {
			variant: "primary",
			size: "md",
		},
	}, { twMergeConfig: TW_MERGE_CONFIG });

	export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
	export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = "primary",
		size = "md",
		ref = $bindable(null),
		href = undefined,
		type = "button",
		disabled,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? "link" : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
