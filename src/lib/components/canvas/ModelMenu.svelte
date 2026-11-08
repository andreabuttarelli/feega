<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Check from '@lucide/svelte/icons/check';
  import Search from '@lucide/svelte/icons/search';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { tick } from 'svelte';
  import type { GenMedium, GenParams, ModelChoice, RouteOption } from '$lib/canvas/gen-node';
  import { familyGroups, familyOf, modelName, priceHeader, priceLabel, searchModels, TIER_LABEL, IconTone, MenuColumn as Column, type MenuModel } from '$lib/canvas/model-families';
  import { AUTO_ROUTE, pricedFor, routeOf } from '$lib/canvas/model-routes';
  import { routeTiers } from '$lib/canvas/route-tiers';
  import * as Popover from '$lib/components/ui/popover/index.js';
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

  const ROW = 'flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-xs outline-none';
  const ACTIVE = 'bg-foreground/[0.07]';

  let open = $state(false);
  let query = $state('');
  let column = $state(Column.Family);
  let familyIndex = $state(0);
  let modelIndex = $state(0);
  let routeIndex = $state(0);
  let content = $state<HTMLElement | null>(null);
  let search = $state<HTMLInputElement | null>(null);

  const groups = $derived(familyGroups(choices));
  const matches = $derived(searchModels(choices, query));
  const searching = $derived(query.trim().length > 0);
  const models = $derived(searching ? matches : (groups[familyIndex]?.models ?? []));
  const activeModel = $derived<MenuModel | undefined>(models[modelIndex]);
  const activeRoutes = $derived<RouteOption[]>(activeModel && (activeModel.choice.routes?.length ?? 0) > 1 ? activeModel.choice.routes! : []);
  const header = $derived(medium ? priceHeader(medium) : null);
  const current = $derived(value ? choices.find((c) => c.id === value) : undefined);
  const currentRoute = $derived(routeOf(current, provider ?? undefined));

  function placeOnCurrent() {
    query = '';
    column = Column.Family;
    routeIndex = 0;
    const family = groups.findIndex((g) => g.key !== 'recommended' && g.models.some((m) => m.choice.id === value));
    familyIndex = Math.max(family, 0);
    modelIndex = Math.max(groups[familyIndex]?.models.findIndex((m) => m.choice.id === value) ?? 0, 0);
  }

  $effect(() => {
    if (open) {
      placeOnCurrent();
    }
  });

  $effect(() => {
    void [column, familyIndex, modelIndex, routeIndex, query];
    tick().then(() => content?.querySelectorAll<HTMLElement>('[data-active="true"]').forEach((el) => el.scrollIntoView({ block: 'nearest' })));
  });

  function pick(id: string, route: string | null) {
    onselect(id, route);
    open = false;
  }

  function wrap(index: number, length: number): number {
    return length ? (index + length) % length : 0;
  }

  function step(delta: number) {
    if (column === Column.Family && !searching) {
      familyIndex = wrap(familyIndex + delta, groups.length);
      modelIndex = 0;
      return;
    }
    if (column === Column.Route) {
      routeIndex = wrap(routeIndex + delta, activeRoutes.length);
      return;
    }
    modelIndex = wrap(modelIndex + delta, models.length);
  }

  function enter() {
    if (column === Column.Family && !searching) {
      column = Column.Model;
      modelIndex = 0;
      return;
    }
    if (!activeModel) {
      return;
    }
    if (column === Column.Route) {
      pick(activeModel.choice.id, activeRoutes[routeIndex]?.provider ?? null);
      return;
    }
    pick(activeModel.choice.id, null);
  }

  function right() {
    if (column === Column.Family && !searching) {
      column = Column.Model;
      modelIndex = 0;
      return;
    }
    if (column === Column.Model && activeRoutes.length) {
      column = Column.Route;
      routeIndex = 0;
    }
  }

  function left() {
    if (column === Column.Route) {
      column = Column.Model;
      return;
    }
    if (!searching) {
      column = Column.Family;
    }
  }

  const KEYS: Record<string, () => void> = {
    ArrowDown: () => step(1),
    ArrowUp: () => step(-1),
    ArrowRight: right,
    ArrowLeft: left,
    Enter: enter
  };

  function keys(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      return;
    }
    event.stopPropagation();
    const action = KEYS[event.key];
    if (!action) {
      return;
    }
    if (searching && column === Column.Model && event.key === 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    action();
  }

  function typed() {
    column = searching ? Column.Model : Column.Family;
    modelIndex = 0;
  }

  function routePrice(choice: ModelChoice, route: string): string | null {
    return medium ? priceLabel(pricedFor(choice, { provider: route }) ?? choice, medium) : null;
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

{#snippet modelRow(model: MenuModel, index: number, showFamily: boolean)}
  {@const chosen = model.choice.id === value}
  {@const active = index === modelIndex && column !== Column.Family}
  {@const price = medium ? priceLabel(model.choice, medium) : null}
  <button
    type="button"
    role="option"
    aria-selected={chosen}
    tabindex="-1"
    class="{ROW} {active ? ACTIVE : ''} hover:bg-foreground/[0.07]"
    data-active={active}
    data-testid={`model-${model.choice.id}`}
    onmouseenter={() => {
      modelIndex = index;
      column = Column.Model;
    }}
    onclick={() => pick(model.choice.id, null)}
  >
    {#if showFamily}
      <span class="flex size-4 shrink-0 items-center justify-center text-ui-text"><ProviderIcon provider={model.family.icon ?? model.family.key} size={13} tone={IconTone.Mono} /></span>
    {/if}
    <span class="truncate font-medium text-ui-text">{model.name}</span>
    {#if showFamily}<span class="shrink-0 truncate text-muted-foreground">{model.family.label}</span>{/if}
    {@render badges(model.choice)}
    {#if chosen && currentRoute && currentRoute.provider !== AUTO_ROUTE}
      <span class="shrink-0 rounded-full bg-foreground/[0.06] px-1.5 text-[0.625rem] leading-4 text-muted-foreground" data-testid="route-trigger">{currentRoute.label}</span>
    {/if}
    <span class="ml-auto shrink-0 pl-2 text-muted-foreground tabular-nums">{price ?? ''}</span>
    <Check class="size-3.5 shrink-0 {chosen ? '' : 'invisible'}" aria-hidden="true" />
  </button>
{/snippet}

<Popover.Root bind:open>
  <Popover.Trigger
    aria-label="Model"
    data-control="model"
    class="{CONTROL_HEIGHT} inline-flex max-w-56 min-w-0 items-center gap-1.5 rounded-sm bg-transparent px-2 text-left text-xs text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted"
  >
    {#if mixed}
      <span class="truncate">{MIXED_TEXT}</span>
    {:else if current}
      <ProviderIcon provider={familyOf(current).icon ?? current.provider} tone={IconTone.Mono} />
      <span class="truncate font-medium">{modelName(current)}</span>
      {#if currentRoute}<span class="shrink-0 text-muted-foreground" data-testid="route-trigger">· {currentRoute.provider === AUTO_ROUTE ? 'Auto' : currentRoute.label}</span>{/if}
    {:else}
      <span class="truncate text-muted-foreground">Choose model</span>
    {/if}
    <ChevronDown class="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
  </Popover.Trigger>
  <Popover.Content
    bind:ref={content}
    class="w-[36rem] p-0"
    data-testid="model-menu"
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      search?.focus();
    }}
    onkeydown={keys}
  >
    <label class="flex h-10 shrink-0 items-center gap-2 border-b border-line-2 px-3 text-muted-foreground">
      <Search class="size-3.5 shrink-0" aria-hidden="true" />
      <input
        bind:this={search}
        type="text"
        class="h-full w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        aria-label="Search model"
        placeholder="Search models…"
        bind:value={query}
        oninput={typed}
      />
    </label>

    {#if searching}
      <div class="max-h-96 overflow-y-auto p-1.5" role="listbox" aria-label="Models">
        {#if header}
          <div class="flex h-7 items-center justify-between px-2 pr-7.5 text-[0.6875rem] text-muted-foreground"><span>{header.unit}</span><span>{header.detail}</span></div>
        {/if}
        {#each matches as model, index (model.choice.id)}
          {@render modelRow(model, index, true)}
        {:else}
          <p class="px-2 py-3 text-xs text-muted-foreground">No match</p>
        {/each}
      </div>
    {:else}
      <div class="flex max-h-96 min-h-0">
        <div class="w-48 shrink-0 overflow-y-auto border-r border-line-2 p-1.5" role="listbox" aria-label="Families">
          {#each groups as group, index (group.key)}
            {@const active = index === familyIndex}
            <button
              type="button"
              role="option"
              aria-selected={active}
              tabindex="-1"
              class="{ROW} {active ? ACTIVE : ''} hover:bg-foreground/[0.07]"
              data-active={active && column === Column.Family}
              data-testid={`family-${group.key}`}
              onmouseenter={() => {
                familyIndex = index;
                modelIndex = 0;
                column = Column.Family;
              }}
              onclick={() => {
                familyIndex = index;
                column = Column.Model;
              }}
            >
              <span class="flex size-4 shrink-0 items-center justify-center text-ui-text">
                {#if group.icon}
                  <ProviderIcon provider={group.icon} size={13} tone={IconTone.Mono} />
                {:else}
                  <Sparkles class="size-3.5" aria-hidden="true" />
                {/if}
              </span>
              <span class="truncate font-medium text-ui-text">{group.label}</span>
              <span class="ml-auto shrink-0 rounded-full bg-foreground/[0.06] px-1.5 text-[0.625rem] leading-4 text-muted-foreground tabular-nums">{group.models.length}</span>
              <ChevronRight class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          {/each}
        </div>

        <div class="flex min-w-0 flex-1 flex-col">
          <div class="min-h-0 flex-1 overflow-y-auto p-1.5" role="listbox" aria-label="Models">
            {#if header}
              <div class="flex h-7 items-center justify-between px-2 pr-7.5 text-[0.6875rem] text-muted-foreground"><span>{header.unit}</span><span>{header.detail}</span></div>
            {/if}
            {#each models as model, index (model.choice.id)}
              {@render modelRow(model, index, false)}
            {/each}
          </div>

          {#if activeRoutes.length && activeModel}
            {@const tiers = medium ? routeTiers(activeModel.choice, medium, params) : {}}
            <div class="shrink-0 border-t border-line-2 px-3 py-2" data-testid="route-menu">
              <div class="mb-1.5 text-[0.6875rem] text-muted-foreground">Run {activeModel.name} on</div>
              <div class="flex flex-wrap gap-1">
                {#each activeRoutes as route, index (route.provider)}
                  {@const chosen = activeModel.choice.id === value && (provider ?? AUTO_ROUTE) === route.provider}
                  {@const active = column === Column.Route && index === routeIndex}
                  <button
                    type="button"
                    tabindex="-1"
                    class="inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-[0.6875rem] outline-none {chosen ? 'border-foreground/40 text-ui-text' : 'border-line-2 text-muted-foreground'} {active ? ACTIVE : ''} hover:bg-foreground/[0.07]"
                    data-active={active}
                    data-testid={`route-${route.provider}`}
                    title={routePrice(activeModel.choice, route.provider) ?? undefined}
                    onmouseenter={() => {
                      column = Column.Route;
                      routeIndex = index;
                    }}
                    onclick={() => pick(activeModel.choice.id, route.provider)}
                  >
                    <span>{route.provider === AUTO_ROUTE ? 'Auto · cheapest' : route.label}</span>
                    {#if tiers[route.provider]}<span class="font-mono" data-testid={`tier-${route.provider}`}>{tiers[route.provider]}</span>{/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </Popover.Content>
</Popover.Root>
