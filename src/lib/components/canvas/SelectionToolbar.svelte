<script lang="ts">
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Maximize2 from '@lucide/svelte/icons/maximize-2';
  import Columns2 from '@lucide/svelte/icons/columns-2';
  import { OUTPUT_KIND_OF } from '$lib/canvas/run-info';
  import Square from '@lucide/svelte/icons/square';
  import { isFrameDialogAction } from '$lib/canvas/frame-dialogs';
  import { actionsIn, enabledFor, shownFor, type SelectionAction, type SelectionActionId } from '$lib/canvas/selection-actions';
  import type { WorkflowEdge } from '$lib/canvas/workflow-plan';
  import { SELECTION_ACTION_ICON } from '$lib/canvas/selection-action-icons';
  import { commonPropertiesOf, dynamicParamsOf, type GenPropertyType } from '$lib/canvas/common-properties';
  import { effectiveModel } from '$lib/canvas/default-models';
  import { nodeControlsOf, type SelectionPatch } from '$lib/canvas/node-controls';
  import { runLabelOf, type RunQuote } from '$lib/canvas/run-quote';
  import { TOOLBAR_HIDE_BELOW_ZOOM, toolbarScale } from '$lib/canvas/toolbar-scale';
  import { TOOLBAR_GAP, toolbarAnchor } from '$lib/canvas/toolbar-position';
  import type { ModelChoice } from '$lib/canvas/gen-node';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import { formatPrice } from '$lib/components/credit-amount-format';
  import { cn } from '$lib/utils.js';
  import ModelMenu from './ModelMenu.svelte';
  import VariantsMenu from './VariantsMenu.svelte';
  import HistoryMenu from './HistoryMenu.svelte';
  import type { HistoryItem } from '$lib/canvas/gen-history';
  import type { VariantInto } from '$lib/canvas/variants';
  import { PROVIDER_PARAM } from '$lib/canvas/model-routes';
  import NodeSettings from './NodeSettings.svelte';
  import { SECTION_TYPE } from '$lib/canvas/section';
  import Cloud from '@lucide/svelte/icons/cloud';
  import { CLOUD_PROVIDERS, PROVIDER_LABEL, type CloudProviderId } from '$lib/canvas/cloud-picker';
  import { COLOUR_TAGS, COLOUR_TAG_HEX, colourOf, type ColourTag } from '$lib/canvas/node-colour';
  import { SECTION_DEFAULT_FILL } from '$lib/canvas/node-data';

  const ICON_BUTTON = 'size-11 md:size-8';

  let {
    box,
    zoom = 1,
    count,
    nodeSummaries = [],
    edges = [],
    stale = [],
    choicesFor,
    catalogueSynced = true,
    runQuote = null,
    frameTools = false,
    onrun,
    oncancelvariants,
    variantsInFlight = 0,
    history = null,
    onaction,
    onpropertychange,
    onsectionchange,
    oncolourchange,
    onview,
    onstop,
    oncompare,
    onexportcloud
  }: {
    box: { x: number; y: number; width: number } | null;
    zoom?: number;
    count: number;
    nodeSummaries?: { id: string; type: string; data: Record<string, unknown> }[];
    edges?: WorkflowEdge[];
    stale?: string[];
    choicesFor?: (type: GenPropertyType) => ModelChoice[];
    catalogueSynced?: boolean;
    runQuote?: RunQuote | null;
    frameTools?: boolean;
    onrun?: () => void;
    oncancelvariants?: () => void;
    variantsInFlight?: number;
    history?: { items: HistoryItem[]; urlOf: (mediaId: string) => string | null; onshow: (runId: string) => void } | null;
    onaction?: (id: SelectionActionId) => void;
    onpropertychange?: (patch: SelectionPatch & { model?: string | null; variants?: number; variantsInto?: VariantInto }) => void;
    onsectionchange?: (id: string, patch: { title?: string; fill?: string }) => void;
    oncolourchange?: (tag: ColourTag | null) => void;
    onview?: () => void;
    onstop?: () => void;
    oncompare?: () => void;
    onexportcloud?: (provider: CloudProviderId) => void;
  } = $props();

  const comparable = $derived(count === 2 && nodeSummaries.length === 2 && nodeSummaries.every((n) => n.type === 'image' && typeof n.data.refId === 'string'));

  const viewable = $derived(count === 1 && !!nodeSummaries[0] && nodeSummaries[0].type in OUTPUT_KIND_OF && typeof nodeSummaries[0].data.refId === 'string');

  const running = $derived(count === 1 && nodeSummaries[0]?.data.running === true);
  const exportable = $derived(count === 1 && !!onexportcloud && ['image', 'video'].includes(nodeSummaries[0]?.type ?? '') && (typeof nodeSummaries[0]?.data.assetId === 'string' || typeof nodeSummaries[0]?.data.refId === 'string'));

  const sharedColour = $derived.by(() => {
    const tags = new Set(nodeSummaries.map((node) => colourOf(node.data)));
    return tags.size === 1 ? [...tags][0] : null;
  });

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
  const section = $derived(count === 1 && nodeSummaries[0]?.type === SECTION_TYPE ? nodeSummaries[0] : null);
  const sectionTitle = $derived(typeof section?.data.title === 'string' ? section.data.title : '');
  const sectionFill = $derived(typeof section?.data.fill === 'string' ? section.data.fill : SECTION_DEFAULT_FILL);
  const choices = $derived(properties.type && choicesFor ? choicesFor(properties.type) : []);
  const modelValue = $derived(
    properties.model.kind === 'same' && properties.type ? effectiveModel(properties.type, properties.model.value, choices) : null
  );
  const choice = $derived(modelValue ? choices.find((c) => c.id === modelValue) : null);
  const dynamicValues = $derived(dynamicParamsOf(nodeSummaries, (choice?.params ?? []).map((p) => p.name)));
  const providerValue = $derived.by(() => {
    const value = dynamicParamsOf(nodeSummaries, [PROVIDER_PARAM])[PROVIDER_PARAM];
    return value.kind === 'same' && typeof value.value === 'string' ? value.value : null;
  });
  const controls = $derived(nodeControlsOf(properties, choice, dynamicValues));

  const primary = $derived(actionsIn('primary', count));
  const secondary = $derived(actionsIn('secondary', count).filter((a) => shownFor(a.id, nodeSummaries)));
  const overflow = $derived(actionsIn('overflow', count).filter((a) => shownFor(a.id, nodeSummaries) && (frameTools || !isFrameDialogAction(a.id))));
  const danger = $derived(actionsIn('danger', count));

  function gateOf(action: SelectionAction) {
    return enabledFor(action.id, nodeSummaries, edges, stale);
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
              provider={providerValue}
              mixed={properties.model.kind === 'mixed'}
              medium={runQuote?.cost.medium ?? null}
              params={runQuote?.cost.params ?? {}}
              onselect={(id, provider) => onpropertychange?.({ model: id || null, dynamicParams: { [PROVIDER_PARAM]: provider } })}
            />
          {/if}
          {#if controls.length}
            <NodeSettings {controls} onchange={(patch) => onpropertychange?.(patch)} />
          {/if}
        </div>
      {/if}

      {#if section}
        <div class="group" role="group" aria-label="Section">
          <input class="section-title" aria-label="Section title" value={sectionTitle} onchange={(e) => onsectionchange?.(section.id, { title: e.currentTarget.value.trim() || 'Section' })} onkeydown={(e) => e.stopPropagation()} />
          <input class="section-fill" type="color" aria-label="Section fill" value={sectionFill} onchange={(e) => onsectionchange?.(section.id, { fill: e.currentTarget.value })} />
        </div>
      {/if}

      {#if running}
        <div class="group" role="group" aria-label="Stop">
          <Button size="sm" variant="secondary" class="h-11 md:h-8" data-testid="stop-run" onclick={() => onstop?.()}>
            <Square strokeWidth={1.8} />
            Stop
          </Button>
        </div>
      {/if}

      {#if runQuote || primary.length}
        <div class="group" role="group" aria-label="Run">
          {#if history && properties.type && runQuote}
            <HistoryMenu items={history.items} medium={properties.type} urlOf={history.urlOf} onshow={history.onshow} />
          {/if}
          {#if runQuote?.variants}
            <VariantsMenu quote={runQuote.variants} onchange={(patch) => onpropertychange?.(patch)} />
          {/if}
          {#if runQuote}
            {#if runQuote.credits !== null}
              <span class="run-price" data-testid="run-price">{formatPrice(runQuote.credits)}</span>
            {:else if runQuote.variable}
              <span class="run-price">variable</span>
            {/if}
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <Button {...props} size="icon-sm" class="size-11 rounded-full md:size-8" data-control="run" aria-label={runLabelOf(runQuote)} disabled={!runQuote.enabled} onclick={() => onrun?.()}>
                    <ArrowUp strokeWidth={2.25} />
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content side="top">{runQuote.reason ?? runLabelOf(runQuote)}</Tooltip.Content>
            </Tooltip.Root>
            {#if variantsInFlight > 0}
              <Button size="sm" variant="secondary" class="h-11 md:h-8" data-control="cancel-variants" onclick={() => oncancelvariants?.()}>
                Cancel all ({variantsInFlight})
              </Button>
            {/if}
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
        {#if viewable}
          <Button variant="ghost" size="sm" class="h-11 md:h-8" data-testid="view-output" onclick={() => onview?.()}>
            <Maximize2 strokeWidth={1.7} />
            View
          </Button>
        {/if}
        {#if comparable}
          <Button variant="ghost" size="sm" class="h-11 md:h-8" data-testid="compare-outputs" onclick={() => oncompare?.()}>
            <Columns2 strokeWidth={1.7} />
            Compare
          </Button>
        {/if}
        {#each secondary as action (action.id)}
          {@render iconAction(action, '')}
        {/each}
        {#if exportable}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button {...props} variant="ghost" size="icon-sm" class={ICON_BUTTON} aria-label="Export to cloud" data-testid="export-cloud-menu">
                  <Cloud strokeWidth={1.7} />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-48">
              {#each CLOUD_PROVIDERS as provider (provider)}
                <DropdownMenu.Item class="min-h-11 md:min-h-8" data-testid={`export-${provider}`} onSelect={() => onexportcloud?.(provider)}>Export to {PROVIDER_LABEL[provider]}</DropdownMenu.Item>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
        {#if oncolourchange}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button {...props} variant="ghost" size="icon-sm" class={ICON_BUTTON} aria-label="Colour tag" data-testid="colour-tag-menu">
                  <span class="tag-dot" style={`--tag:${sharedColour ? COLOUR_TAG_HEX[sharedColour] : 'transparent'}`}></span>
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-auto p-2">
              <div class="tag-row">
                {#each COLOUR_TAGS as tag (tag)}
                  <DropdownMenu.Item class="tag-pick" aria-label={`Tag ${tag}`} data-testid={`colour-tag-${tag}`} onSelect={() => oncolourchange(tag)}>
                    <span class="tag-dot" style={`--tag:${COLOUR_TAG_HEX[tag]}`}></span>
                  </DropdownMenu.Item>
                {/each}
                <DropdownMenu.Item class="tag-pick" aria-label="Clear tag" data-testid="colour-tag-clear" onSelect={() => oncolourchange(null)}>
                  <span class="tag-dot"></span>
                </DropdownMenu.Item>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
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
    background: var(--ui-raised);
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-lg);
    box-shadow: var(--ui-shadow-float);
  }

  .toolbar {
    flex-wrap: wrap;
    row-gap: 4px;
    max-width: min(560px, calc(100vw - 16px));
  }

  .group[aria-label='Actions'] {
    flex-basis: 100%;
    justify-content: flex-start;
    padding: 4px 0 0;
    border-left: 0;
    border-top: 1px solid var(--ui-divider);
  }

  .toolbar :global(button),
  .toolbar :global([data-control]) {
    border-radius: var(--ui-radius-md);
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
    border-left: 1px solid var(--ui-divider);
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

  .run-price {
    padding: 0 2px 0 4px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--ui-text-secondary);
    white-space: nowrap;
  }

  .tag-row {
    display: flex;
    gap: 4px;
  }

  .tag-dot {
    display: block;
    width: 14px;
    height: 14px;
    border: 1.5px solid var(--tag, var(--ui-ink-3));
    border-radius: 9999px;
    background: var(--tag, transparent);
  }

  .section-title {
    width: 9rem;
    padding: 0 0.5rem;
    font-size: 0.8125rem;
    background: transparent;
  }

  .section-fill {
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 0;
    background: transparent;
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
    color: var(--ui-text-secondary);
    white-space: nowrap;
  }
</style>
