<script lang="ts">
	import ListMenu from "./list-menu.svelte";
	import { DEFAULT_TEXT, MIXED_TEXT, type ControlProps } from "./types";

	let { label, value, mixed = false, options = [], disabled = false, onchange }: ControlProps = $props();

	const current = $derived(mixed || value === null ? null : String(value));
	const shown = $derived(mixed ? MIXED_TEXT : (options.find((o) => o.value === current)?.label ?? current ?? DEFAULT_TEXT));
</script>

<ListMenu
	{label}
	{disabled}
	groups={[{ id: "all", label: "", items: options }]}
	value={current}
	onselect={onchange}
	triggerClass="w-full"
	contentClass="w-(--bits-floating-anchor-width) min-w-48"
>
	{#snippet trigger()}
		<span class="truncate">{shown}</span>
	{/snippet}
</ListMenu>
