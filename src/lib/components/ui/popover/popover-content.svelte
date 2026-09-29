<script lang="ts" module>
	export const POPOVER_COLLISION_PADDING = 8;
	export const POPOVER_SIDE_OFFSET = 6;
</script>

<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		sideOffset = POPOVER_SIDE_OFFSET,
		align = "start",
		class: className,
		...restProps
	}: PopoverPrimitive.ContentProps = $props();
</script>

<PopoverPrimitive.Portal>
	<PopoverPrimitive.Content
		bind:ref
		data-slot="popover-content"
		{sideOffset}
		{align}
		collisionPadding={POPOVER_COLLISION_PADDING}
		avoidCollisions
		sticky="always"
		class={cn(
			"z-80 flex max-h-(--bits-floating-available-height) w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden border border-line-2 bg-popover font-sans text-popover-foreground shadow-md outline-none",
			className
		)}
		{...restProps}
	/>
</PopoverPrimitive.Portal>
