<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Check from '@lucide/svelte/icons/check';
  import Search from '@lucide/svelte/icons/search';
  import type { GenMedium, GenParams, ModelChoice } from '$lib/canvas/gen-node';
  import { modelGroupsOf, RECOMMENDED_GROUP, TIER_LABEL } from '$lib/canvas/model-picker';
  import { AUTO_ROUTE, routeOf, routeStatsLabel } from '$lib/canvas/model-routes';
  import { routeTiers } from '$lib/canvas/route-tiers';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import { CONTROL_HEIGHT, MIXED_TEXT } from '$lib/components/ui/control/index.js';
  import ProviderIcon from './ProviderIcon.svelte';

  let {
    choices,
    value,
    provider = null,
    mixed = false,
    medium = null,
    params = {},
    onselect
  }: {
    choices: ModelChoice[];
    value: string | null;
    provider?: string | null;
    mixed?: boolean;
    medium?: GenMedium | null;
    params?: GenParams;
    onselect: (id: string, provider: string | null) => void;
  } = $props();

  const ROW = 'data-highlighted:bg-foreground/10 data-[state=open]:bg-foreground/10';
  const SUB_MENU = 'z-50 w-64 max-h-96 overflow-y-auto rounded-md bg-ui-raised p-1 text-ui-text shadow-ui-float';

  let open = $state(false);
  let query = $state('');

  const byId = $derived(new Map(choices.map((c) => [c.id, c])));
  const groups = $derived(modelGroupsOf(choices));
  const current = $derived(value ? byId.get(value) : undefined);
  const currentRoute = $derived(routeOf(current, provider ?? undefined));
  const matches = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return q ? choices.filter((c) => `${c.label} ${c.providerLabel}`.toLowerCase().includes(q)) : [];
  });

  $effect(() => {
    if (!open) {
      query = '';
    }
  });

  function routed(choice: ModelChoice): boolean {
    return (choice.routes?.length ?? 0) > 1;
  }

  function pick(id: string, route: string | null) {
    onselect(id, route);
    open = false;
  }

  function searchKeys(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'Escape' || event.key === 'Tab') {
      return;
    }
    event.stopPropagation();
  }
</script>

{#snippet badges(choice: ModelChoice)}
  {#if choice.uncensored}
    <span class="shrink-0 rounded-xs border border-destructive px-1 text-[0.625rem] leading-4 text-destructive" data-testid="uncensored-badge">Uncensored</span>
  {/if}
  {#if choice.tiers?.[0]}
    <span class="shrink-0 rounded-xs border border-line-2 px-1 text-[0.625rem] leading-4 text-muted-foreground">{TIER_LABEL[choice.tiers[0]]}</span>
  {/if}
{/snippet}

{#snippet routes(choice: ModelChoice)}
  {@const tiers = medium ? routeTiers(choice, medium, params) : {}}
  {#each choice.routes ?? [] as route (route.provider)}
    {@const chosen = choice.id === value && (provider ?? AUTO_ROUTE) === route.provider}
    <DropdownMenu.Item class="items-start {ROW}" data-testid={`route-${route.provider}`} onSelect={() => pick(choice.id, route.provider)}>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="flex items-center gap-2">
          <span class="truncate font-medium">{route.provider === AUTO_ROUTE ? 'Auto' : route.label}</span>
          {#if tiers[route.provider]}
            <span class="ml-auto font-mono text-[0.6875rem] tracking-wide" data-testid={`tier-${route.provider}`} aria-label={`Price tier ${tiers[route.provider]}`}>
              <span class="text-foreground">{tiers[route.provider]}</span><span class="text-muted-foreground/40">{'$$$'.slice(tiers[route.provider].length)}</span>
            </span>
          {/if}
        </span>
        {#if routeStatsLabel(route)}
          <span class="truncate text-[0.6875rem] {route.stats?.healthy === false ? 'text-destructive' : 'text-muted-foreground'}">{routeStatsLabel(route)}</span>
        {/if}
      </span>
      <Check class="mt-0.5 size-3.5 {chosen ? '' : 'invisible'}" aria-hidden="true" />
    </DropdownMenu.Item>
  {/each}
{/snippet}

{#snippet model(choice: ModelChoice)}
  {@const chosen = choice.id === value}
  {#if routed(choice)}
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger class={ROW} data-testid={`model-${choice.id}`}>
        <span class="truncate">{choice.label}</span>
        {@render badges(choice)}
        {#if chosen}<Check class="ml-auto size-3.5" aria-hidden="true" />{/if}
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent class={SUB_MENU} data-testid="route-menu">
            <DropdownMenu.Label class="px-2 pt-1.5 pb-1 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">Run on</DropdownMenu.Label>
          {@render routes(choice)}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
  {:else}
    <DropdownMenu.Item class={ROW} data-testid={`model-${choice.id}`} onSelect={() => pick(choice.id, null)}>
      <span class="truncate">{choice.label}</span>
      {@render badges(choice)}
      <Check class="ml-auto size-3.5 {chosen ? '' : 'invisible'}" aria-hidden="true" />
    </DropdownMenu.Item>
  {/if}
{/snippet}

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger
    aria-label="Model"
    data-control="model"
    class="{CONTROL_HEIGHT} inline-flex max-w-56 min-w-0 items-center gap-1.5 rounded-sm bg-transparent px-2 text-left text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted"
  >
    {#if mixed}
      <span class="truncate">{MIXED_TEXT}</span>
    {:else if current}
      <ProviderIcon provider={current.provider} />
      <span class="truncate font-medium">{current.label}</span>
      {#if currentRoute}<span class="shrink-0 text-muted-foreground" data-testid="route-trigger">· {currentRoute.provider === AUTO_ROUTE ? 'Auto' : currentRoute.label}</span>{/if}
    {:else}
      <span class="truncate text-muted-foreground">Choose model</span>
    {/if}
    <ChevronDown class="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content class="w-64 max-h-[28rem] p-1.5" data-testid="model-menu">
    <label class="mb-1 flex h-9 items-center gap-2 rounded-sm bg-muted/60 px-2 text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
      <Search class="size-3.5 shrink-0" aria-hidden="true" />
      <input
        type="search"
        class="h-full w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        aria-label="Search model"
        placeholder="Search models…"
        bind:value={query}
        onkeydown={searchKeys}
      />
    </label>
    {#if query.trim()}
      {#each matches as choice (choice.id)}
        {@render model(choice)}
      {:else}
        <p class="px-2 py-3 text-xs text-muted-foreground">No match</p>
      {/each}
    {:else}
      {#each groups as group (group.id)}
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger class={ROW} data-testid={`family-${group.id}`}>
            {#if group.id !== RECOMMENDED_GROUP}<ProviderIcon provider={group.id} />{/if}
            <span class="truncate">{group.label}</span>
          </DropdownMenu.SubTrigger>
          <DropdownMenu.Portal>
            <DropdownMenu.SubContent class={SUB_MENU}>
              <DropdownMenu.Label class="px-2 pt-1.5 pb-1 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">{group.label}</DropdownMenu.Label>
              {#each group.items as entry (entry.value)}
                {@const choice = byId.get(entry.value)}
                {#if choice}{@render model(choice)}{/if}
              {/each}
            </DropdownMenu.SubContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Sub>
      {/each}
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>
