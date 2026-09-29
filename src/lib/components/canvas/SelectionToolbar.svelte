<script lang="ts">
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { actionsIn, enabledFor, type SelectionAction, type SelectionActionId } from '$lib/canvas/selection-actions';
  import type { WorkflowEdge } from '$lib/canvas/workflow-plan';
  import { SELECTION_ACTION_ICON } from '$lib/canvas/selection-action-icons';
  import { commonPropertiesOf, dynamicParamsOf } from '$lib/canvas/common-properties';
  import { effectiveModel } from '$lib/canvas/default-models';
  import { nodeControlsOf, type SelectionPatch } from '$lib/canvas/node-controls';
  import type { RunQuote } from '$lib/canvas/run-quote';
  import { TOOLBAR_HIDE_BELOW_ZOOM, toolbarScale } from '$lib/canvas/toolbar-scale';
  import { TOOLBAR_GAP, toolbarAnchor } from '$lib/canvas/toolbar-position';
  import type { ModelChoice } from '$lib/canvas/gen-node';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import { cn } from '$lib/utils.js';
  import ModelMenu from './ModelMenu.svelte';
  import NodeSettings from './NodeSettings.svelte';

  const ICON_BUTTON = 'size-11 md:size-8';

  let {
    box,
    zoom = 1,
    count,
    nodeSummaries = [],
    edges = [],
    choicesFor,
    catalogueSynced = true,
    runQuote = null,
    onrun,
    onaction,
    onpropertychange
  }: {
    box: { x: number; y: number; width: number } | null;
    zoom?: number;
    count: number;
    nodeSummaries?: { id: string; type: string; data: Record<string, unknown> }[];
    edges?: WorkflowEdge[];
    choicesFor?: (type: 'text' | 'image' | 'video') => ModelChoice[];
    catalogueSynced?: boolean;
    runQuote?: RunQuote | null;
    onrun?: () => void;
    onaction?: (id: SelectionActionId) => void;
    onpropertychange?: (patch: SelectionPatch & { model?: string | null }) => void;
  } = $props();

  const visible = $derived(box !== null && zoom >= TOOLBAR_HIDE_BELOW_ZOOM);
  const scale = $derived(toolbarScale(zoom));

  let toolbarWidth = $state(0);
  let toolbarHeight = $state(0);
  let innerWidth = $state(0);
  let innerHeight = $state(0);

  const anchor = $derived(
    box
      ? toolbarAnchor(box, { width: toolbarWidth * scale, height: toolbarHeight * scale }, { width: innerWidth, height: innerHeight })
      : null
  );

  const properties = $derived(commonPropertiesOf(nodeSummaries));
  const choices = $derived(properties.type && choicesFor ? choicesFor(properties.type) : []);
  const modelValue = $derived(
    properties.model.kind === 'same' && properties.type ? effectiveModel(properties.type, properties.model.value, choices) : null
  );
  const choice = $derived(modelValue ? choices.find((c) => c.id === modelValue) : null);
  const dynamicValues = $derived(dynamicParamsOf(nodeSummaries, (choice?.params ?? []).map((p) => p.name)));
  const controls = $derived(nodeControlsOf(properties, choice, dynamicValues));

  const primary = $derived(actionsIn('primary', count));
  const secondary = $derived(actionsIn('secondary', count));
  const overflow = $derived(actionsIn('overflow', count));
  const danger = $derived(actionsIn('danger', count));

  function gateOf(action: SelectionAction) {
    return enabledFor(action.id, nodeSummaries, edges);
  }
</script>

{#snippet iconAction(action: SelectionAction, tone: string)}
  {@const Icon = SELECTION_ACTION_ICON[action.id]}
  {@const gate = gateOf(action)}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="ghost"
          size="icon-sm"
          class={cn(ICON_BUTTON, tone)}
          aria-label={action.label}
          disabled={!gate.enabled}
          onclick={() => onaction?.(action.id)}
        >
          <Icon strokeWidth={1.7} />
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top">{gate.reason ?? action.label}</Tooltip.Content>
  </Tooltip.Root>
{/snippet}

<svelte:window bind:innerWidth bind:innerHeight />

{#if visible && anchor}
  <div
    class="toolbar"
    bind:offsetWidth={toolbarWidth}
    bind:offsetHeight={toolbarHeight}
    style={`left:${anchor.x}px; top:${anchor.y}px; --toolbar-scale:${scale}; --toolbar-gap:${TOOLBAR_GAP}px`}
    role="toolbar"
    aria-label="Selection actions"
  >
    <Tooltip.Provider delayDuration={200}>
      {#if properties.type}
        <div class="group" role="group" aria-label="Node properties">
          {#if !choices.length && !catalogueSynced}
            <span class="warn">Catalog not synced</span>
          {:else}
            <ModelMenu
              {choices}
              value={modelValue}
              mixed={properties.model.kind === 'mixed'}
              onselect={(id) => onpropertychange?.({ model: id || null })}
            />
          {/if}
          {#if controls.length}
            <NodeSettings {controls} onchange={(patch) => onpropertychange?.(patch)} />
          {/if}
        </div>
      {/if}

      {#if runQuote || primary.length}
        <div class="group" role="group" aria-label="Run">
          {#if runQuote}
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <Button {...props} size="sm" class="h-11 md:h-8" data-control="run" disabled={!runQuote.enabled} onclick={() => onrun?.()}>
                    <Sparkles strokeWidth={1.8} />
                    {runQuote.label}
                    {#if runQuote.credits !== null}
                      <span class="opacity-70">· <CreditAmount amount={runQuote.credits} approx /></span>
                    {:else if runQuote.variable}
                      <span class="opacity-70">· variable cost</span>
                    {/if}
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content side="top">{runQuote.reason ?? 'Run this node'}</Tooltip.Content>
            </Tooltip.Root>
          {/if}
          {#each primary as action (action.id)}
            {@const Icon = SELECTION_ACTION_ICON[action.id]}
            {@const gate = gateOf(action)}
            <Button size="sm" variant={runQuote ? 'secondary' : 'primary'} class="h-11 md:h-8" disabled={!gate.enabled} title={gate.reason} onclick={() => onaction?.(action.id)}>
              <Icon strokeWidth={1.8} />
              {action.label}
            </Button>
          {/each}
        </div>
      {/if}

      <div class="group" role="group" aria-label="Actions">
        {#if count > 1}
          <span class="count">{count} selected</span>
        {/if}
        {#each secondary as action (action.id)}
          {@render iconAction(action, '')}
        {/each}
        {#if overflow.length}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button {...props} variant="ghost" size="icon-sm" class={ICON_BUTTON} aria-label="More actions">
                  <Ellipsis strokeWidth={1.7} />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-48">
              {#each overflow as action (action.id)}
                {@const Icon = SELECTION_ACTION_ICON[action.id]}
                <DropdownMenu.Item class="min-h-11 md:min-h-8" disabled={!gateOf(action).enabled} onSelect={() => onaction?.(action.id)}>
                  <Icon strokeWidth={1.7} />
                  {action.label}
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
        {#each danger as action (action.id)}
          {@render iconAction(action, 'hover:text-destructive')}
        {/each}
      </div>
    </Tooltip.Provider>
  </div>
{/if}

<style>
  .toolbar {
    position: fixed;
    z-index: 15;
    display: flex;
    align-items: center;
    gap: 0;
    max-width: calc(100vw - 16px);
    transform-origin: center bottom;
    transform: translate(-50%, calc(-100% - var(--toolbar-gap))) scale(var(--toolbar-scale, 1));
    padding: 4px;
    font-family: var(--sans);
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.1);
  }

  @media (max-width: 767px) {
    .toolbar {
      left: var(--mobile-bar-inset) !important;
      right: var(--mobile-bar-inset);
      top: calc(var(--mobile-topbar-h) + env(safe-area-inset-top, 0px) + var(--mobile-bar-inset)) !important;
      flex-wrap: wrap;
      row-gap: 4px;
      transform: none;
      box-shadow: var(--mobile-bar-shadow);
    }
  }

  .group {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 0 6px;
  }
  .group + .group {
    border-left: 1px solid var(--line, #e5e5e5);
  }
  .group:first-child {
    padding-left: 0;
  }
  .group:last-child {
    padding-right: 0;
  }

  @media (max-width: 767px) {
    .group {
      flex: 1 1 auto;
      padding: 0;
    }
    .group[aria-label='Node properties'] {
      flex-basis: 100%;
    }
    .group + .group {
      border-left: 0;
    }
    .group[aria-label='Node properties'] > :global(*) {
      flex: 1 1 0;
      max-width: none;
    }
    .group[aria-label='Actions'] {
      justify-content: space-between;
    }
  }

  .warn {
    padding: 0 8px;
    font-size: 12px;
    color: var(--destructive, #c0392b);
    border: 1px dashed currentColor;
    line-height: 30px;
  }

  .count {
    padding: 0 6px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft, #6e6e73);
    white-space: nowrap;
  }
</style>
