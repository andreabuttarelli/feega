<script lang="ts">
	import { untrack, type Snippet } from "svelte";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import Check from "@lucide/svelte/icons/check";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { cn } from "$lib/utils.js";
	import { CONTROL_HEIGHT, SEARCH_MIN_ITEMS, filterGroups, nextIndex, type ListGroup, type ListItem } from "./types";

	let {
		label,
		groups,
		value,
		onselect,
		trigger,
		item,
		groupLabel,
		placeholder = "Search…",
		searchable,
		triggerClass,
		contentClass,
		control = undefined,
		disabled = false,
		open = $bindable(false)
	}: {
		label: string;
		groups: ListGroup[];
		value: string | null;
		onselect: (value: string) => void;
		trigger: Snippet;
		item?: Snippet<[ListItem, boolean]>;
		groupLabel?: Snippet<[ListGroup]>;
		placeholder?: string;
		searchable?: boolean;
		triggerClass?: string;
		contentClass?: string;
		control?: string;
		disabled?: boolean;
		open?: boolean;
	} = $props();

	let query = $state("");
	let active = $state(-1);
	let list = $state<HTMLElement | null>(null);

	const total = $derived(groups.reduce((n, g) => n + g.items.length, 0));
	const withSearch = $derived(searchable ?? total >= SEARCH_MIN_ITEMS);
	const visible = $derived(filterGroups(groups, query));
	const flat = $derived(visible.flatMap((g) => g.items.map((i) => ({ group: g.id, item: i }))));

	$effect(() => {
		if (!open) {
			query = "";
			active = -1;
			return;
		}
		untrack(() => {
			active = flat.findIndex((f) => f.item.value === value);
		});
	});

	function choose(v: string) {
		onselect(v);
		open = false;
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === "Enter" && active >= 0 && flat[active]) {
			event.preventDefault();
			choose(flat[active].item.value);
			return;
		}
		const next = nextIndex(active, event.key, flat.length);
		if (next === null || event.key === "Home" || event.key === "End") {
			return;
		}
		event.preventDefault();
		active = next;
		list?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
	}

	function indexOf(groupId: string, v: string): number {
		return flat.findIndex((f) => f.group === groupId && f.item.value === v);
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		aria-label={label}
		data-control={control}
		{disabled}
		class={cn(
			CONTROL_HEIGHT,
			"inline-flex min-w-0 max-w-full items-center gap-1.5 border border-line-2 bg-background px-2 text-left text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted disabled:opacity-50",
			triggerClass
		)}
	>
		{@render trigger()}
		<ChevronDown class="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Content class={contentClass} onkeydown={keydown}>
		{#if withSearch}
			<input
				type="search"
				class="h-11 w-full shrink-0 border-0 border-b border-line-2 bg-background px-3 text-xs outline-none md:h-9"
				aria-label={`Search ${label}`}
				{placeholder}
				bind:value={query}
				oninput={() => (active = 0)}
			/>
		{/if}
		<div bind:this={list} role="listbox" aria-label={label} class="min-h-0 flex-1 overflow-y-auto p-1">
			{#each visible as group (group.id)}
				{#if group.label}
					<div class="flex items-center gap-1.5 px-2 pt-2 pb-1 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
						{#if groupLabel}{@render groupLabel(group)}{:else}{group.label}{/if}
					</div>
				{/if}
				{#each group.items as entry (entry.value)}
					{@const index = indexOf(group.id, entry.value)}
					{@const selected = entry.value === value}
					<button
						type="button"
						role="option"
						aria-selected={selected}
						data-index={index}
						tabindex="-1"
						class={cn(
							"flex min-h-11 w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-foreground outline-none md:min-h-8",
							index === active && "bg-muted"
						)}
						onpointermove={() => (active = index)}
						onclick={() => choose(entry.value)}
					>
						<span class="min-w-0 flex-1">
							{#if item}{@render item(entry, selected)}{:else}{entry.label}{/if}
						</span>
						<Check class={cn("size-3.5 shrink-0", !selected && "invisible")} aria-hidden="true" />
					</button>
				{/each}
			{:else}
				<p class="px-2 py-3 text-xs text-muted-foreground">No match</p>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
