<script lang="ts">
  import type { ModelChoice } from '$lib/canvas/gen-node';
  import { modelGroupsOf, RECOMMENDED_GROUP, TIER_LABEL } from '$lib/canvas/model-picker';
  import { ListMenu, MIXED_TEXT } from '$lib/components/ui/control/index.js';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import ModalityIcons from './ModalityIcons.svelte';
  import ProviderIcon from './ProviderIcon.svelte';

  let {
    choices,
    value,
    mixed = false,
    onselect
  }: {
    choices: ModelChoice[];
    value: string | null;
    mixed?: boolean;
    onselect: (id: string) => void;
  } = $props();

  const groups = $derived(modelGroupsOf(choices));
  const byId = $derived(new Map(choices.map((c) => [c.id, c])));
  const current = $derived(value ? byId.get(value) : undefined);
</script>

{#snippet tier(choice: ModelChoice)}
  {#if choice.tiers?.[0]}
    <span class="shrink-0 border border-line-2 px-1 text-[0.625rem] leading-4 text-muted-foreground">{TIER_LABEL[choice.tiers[0]]}</span>
  {/if}
{/snippet}

<ListMenu
  label="Model"
  control="model"
  {groups}
  value={mixed ? null : value}
  {onselect}
  searchable
  placeholder="Search model or provider…"
  triggerClass="max-w-64"
  contentClass="w-88"
>
  {#snippet trigger()}
    {#if mixed}
      <span class="truncate">{MIXED_TEXT}</span>
    {:else if current}
      <ProviderIcon provider={current.provider} />
      <span class="truncate font-medium">{current.label}</span>
      {@render tier(current)}
    {:else}
      <span class="truncate text-muted-foreground">Choose model</span>
    {/if}
  {/snippet}

  {#snippet groupLabel(group)}
    {#if group.id !== RECOMMENDED_GROUP}<ProviderIcon provider={group.id} />{/if}
    <span>{group.label}</span>
  {/snippet}

  {#snippet item(entry)}
    {@const choice = byId.get(entry.value)}
    {#if choice}
      <span class="flex min-w-0 flex-col gap-0.5">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate font-medium">{choice.label}</span>
          {@render tier(choice)}
          <span class="ml-auto flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <ModalityIcons inputModalities={choice.inputModalities ?? []} />
            {#if typeof choice.unitCredits === 'number'}
              <CreditAmount amount={choice.unitCredits} />
            {/if}
          </span>
        </span>
        {#if choice.recommendedWhy}
          <span class="truncate text-[0.6875rem] text-muted-foreground">{choice.recommendedWhy}</span>
        {/if}
      </span>
    {/if}
  {/snippet}
</ListMenu>
