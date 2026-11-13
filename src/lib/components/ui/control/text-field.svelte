<script lang="ts">
	import { fieldKeys } from "$lib/motion/field-keys";
	import { cn } from "$lib/utils.js";
	import type { ControlProps } from "./types";

	let { label, value, disabled = false, onchange, maxLength }: ControlProps & { maxLength?: number } = $props();
</script>

<textarea
	{@attach fieldKeys}
	aria-label={label}
	maxlength={maxLength}
	rows="2"
	{disabled}
	value={value === null ? "" : String(value)}
	class={cn("w-full min-w-0 resize-y rounded-sm border border-line-2 bg-background px-2 py-1 text-xs outline-none focus-visible:border-ring")}
	onchange={(e) => onchange(e.currentTarget.value)}
></textarea>
