<script lang="ts">
  import type { ModelChoice, RouteOption } from '$lib/canvas/gen-node';
  import { RECOMMENDED_GROUP, TIER_LABEL } from '$lib/canvas/model-picker';
  import { AUTO_ROUTE, parseRouteValue, routeMenuGroups, routeOf, routeStatsLabel, routeValue } from '$lib/canvas/model-routes';
  import { ListMenu, MIXED_TEXT } from '$lib/components/ui/control/index.js';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import ModalityIcons from './ModalityIcons.svelte';
  import ProviderIcon from './ProviderIcon.svelte';
  import { listedCredits } from '$lib/canvas/gen-cost';

  let {
    choices,
    value,
    provider = null,
    mixed = false,
    onselect
  }: {
    choices: ModelChoice[];
    value: string | null;
    provider?: string | null;
    mixed?: boolean;
    onselect: (id: string, provider: string | null) => void;
  } = $props();

  const groups = $derived(routeMenuGroups(choices));
  const byId = $derived(new Map(choices.map((c) => [c.id, c])));
  const current = $derived(value ? byId.get(value) : undefined);
  const currentRoute = $derived(routeOf(current, provider ?? undefined));
  const selected = $derived(current?.routes?.length && value ? routeValue(value, currentRoute?.provider ?? AUTO_ROUTE) : value);

  function select(entry: string) {
    const { model, provider: picked } = parseRouteValue(entry);
    onselect(model, picked);
  }

  function routePrice(choice: ModelChoice, route: RouteOption | undefined): number | undefined {
    return listedCredits(route ? { ...choice, ...route.price } : choice);
  }
</script>

{#snippet tier(choice: ModelChoice)}
  {#if choice.uncensored}
    <span class="shrink-0 border border-destructive px-1 text-[0.625rem] leading-4 text-destructive" data-testid="uncensored-badge">Uncensored</span>
  {/if}
  {#if choice.tiers?.[0]}
    <span class="shrink-0 border border-line-2 px-1 text-[0.625rem] leading-4 text-muted-foreground">{TIER_LABEL[choice.tiers[0]]}</span>
  {/if}
{/snippet}

<ListMenu
  label="Model"
  control="model"
  {groups}
  value={mixed ? null : selected}
  onselect={select}
  searchable
  placeholder="Search model or provider…"
  triggerClass="max-w-72"
  contentClass="w-96"
>
  {#snippet trigger()}
    {#if mixed}
      <span class="truncate">{MIXED_TEXT}</span>
    {:else if current}
      <ProviderIcon provider={current.provider} />
      <span class="truncate font-medium">{current.label}</span>
      {#if currentRoute}<span class="shrink-0 text-muted-foreground" data-testid="route-trigger">· {currentRoute.provider === AUTO_ROUTE ? 'Auto' : currentRoute.label}</span>{/if}
      {@render tier(current)}
    {:else}
      <span class="truncate text-muted-foreground">Choose model</span>
    {/if}
  {/snippet}

  {#snippet groupLabel(group)}
    {@const routed = byId.get(group.id)}
    {#if routed}<ProviderIcon provider={routed.provider} />{:else if group.id !== RECOMMENDED_GROUP}<ProviderIcon provider={group.id} />{/if}
    <span>{group.label}</span>
  {/snippet}

  {#snippet item(entry)}
    {@const parsed = parseRouteValue(entry.value)}
    {@const choice = byId.get(parsed.model)}
    {@const route = routeOf(choice, parsed.provider ?? undefined)}
    {#if choice}
      <span class="flex min-w-0 flex-col gap-0.5" data-testid={route ? `route-${route.provider}` : undefined}>
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate font-medium">{route ? route.label : choice.label}</span>
          {@render tier(choice)}
          <span class="ml-auto flex shrink-0 items-center gap-1.5 text-muted-foreground">
            {#if !route}<ModalityIcons inputModalities={choice.inputModalities ?? []} />{/if}
            {#if typeof routePrice(choice, route) === 'number'}
              <CreditAmount amount={routePrice(choice, route) ?? 0} />
            {:else}
              <span class="text-[0.625rem]">varies</span>
            {/if}
          </span>
        </span>
        {#if route && routeStatsLabel(route)}
          <span class="truncate text-[0.6875rem] {route.stats?.healthy === false ? 'text-destructive' : 'text-muted-foreground'}">{routeStatsLabel(route)}</span>
        {:else if !route && choice.recommendedWhy}
          <span class="truncate text-[0.6875rem] text-muted-foreground">{choice.recommendedWhy}</span>
        {/if}
      </span>
    {/if}
  {/snippet}
</ListMenu>
