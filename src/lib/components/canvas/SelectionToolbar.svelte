<script lang="ts">
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Maximize2 from '@lucide/svelte/icons/maximize-2';
  import Columns2 from '@lucide/svelte/icons/columns-2';
  import { OUTPUT_KIND_OF } from '$lib/canvas/run-info';
  import Square from '@lucide/svelte/icons/square';
  import { isFrameDialogAction } from '$lib/canvas/frame-dialogs';
  import { actionsIn, enabledFor, shownFor, toolbarSlots, type SelectionAction, type SelectionActionId } from '$lib/canvas/selection-actions';
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
  import ColorField from '$lib/components/motion/ColorField.svelte';
  import { ColourDisplay } from '$lib/motion/colour-field';
  import { SECTION_DEFAULT_FILL } from '$lib/canvas/node-data';

  const ICON_BUTTON = 'size-11 md:size-8';
  const TOOLBAR_MIN_WRAP = 340;
  const TOOLBAR_CHROME = 18;

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
    history?: { items: HistoryItem[]; urlOf: (mediaId: string) => string | null; onshow: (runId: string) => void; oncompare: (a: string, b: string) => void } | null;
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
  let leadWidth = $state(0);
  let actionsWidth = $state(0);
  const stacked = $derived(!!box && leadWidth + actionsWidth + TOOLBAR_CHROME > Math.max(box.width / scale, TOOLBAR_MIN_WRAP));

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
  const slots = $derived(toolbarSlots([...secondary, ...overflow, ...danger]));

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

{#snippet runButton()}
  {@const blocked = !running && !runQuote?.enabled}
  {@const label = running ? 'Stop' : runQuote ? runLabelOf(runQuote) : 'Generate'}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          class="run"
          data-control="run"
          data-run={running ? 'running' : blocked ? 'blocked' : 'ready'}
          data-testid={running ? 'stop-run' : undefined}
          aria-label={label}
          aria-disabled={blocked}
          onclick={() => (running ? onstop?.() : blocked ? undefined : onrun?.())}
        >
          {#if running}
            <svg class="run-ring" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" /></svg>
            <Square class="size-3" fill="currentColor" strokeWidth={0} />
          {:else}
            <ArrowUp class="size-4" strokeWidth={2.25} />
          {/if}
        </button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="top">{running ? 'Stop generating' : (runQuote?.reason ?? label)}</Tooltip.Content>
  </Tooltip.Root>
{/snippet}

<svelte:window bind:innerWidth bind:innerHeight />

{#if visible && anchor}
  <div
    class="toolbar"
    class:stacked
    bind:offsetWidth={toolbarWidth}
    bind:offsetHeight={toolbarHeight}
    style={`left:${anchor.x}px; top:${anchor.y}px; --toolbar-scale:${scale}; --toolbar-gap:${TOOLBAR_GAP}px`}
    role="toolbar"
    aria-label="Selection actions"
  >
    <Tooltip.Provider delayDuration={200}>
      <div class="row" bind:offsetWidth={leadWidth}>
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
            <ColorField name="Section fill" display={ColourDisplay.Chip} value={sectionFill} onchange={(v) => onsectionchange?.(section.id, { fill: v })} />
          </div>
        {/if}

        {#if runQuote || running || primary.length}
          <div class="group" role="group" aria-label="Run">
            {#if history && properties.type && runQuote}
              <HistoryMenu items={history.items} medium={properties.type} urlOf={history.urlOf} onshow={history.onshow} oncompare={history.oncompare} />
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
              {#if variantsInFlight > 0}
                <Button size="sm" variant="secondary" class="h-11 md:h-8" data-control="cancel-variants" onclick={() => oncancelvariants?.()}>
                  Cancel all ({variantsInFlight})
                </Button>
              {/if}
            {/if}
            {#if runQuote || running}
              {@render runButton()}
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
      </div>

      <div class="group" role="group" aria-label="Actions" bind:offsetWidth={actionsWidth}>
        {#if count > 1}
          <span class="count">{count} selected</span>
        {/if}
        {#if viewable}
          <Button variant="ghost" size="icon-sm" class={ICON_BUTTON} aria-label="View" title="View" data-testid="view-output" onclick={() => onview?.()}>
            <Maximize2 strokeWidth={1.7} />
          </Button>
        {/if}
        {#if comparable}
          <Button variant="ghost" size="icon-sm" class={ICON_BUTTON} aria-label="Compare" title="Compare" data-testid="compare-outputs" onclick={() => oncompare?.()}>
            <Columns2 strokeWidth={1.7} />
          </Button>
        {/if}
        {#each slots.pinned as action (action.id)}
          {@render iconAction(action, '')}
        {/each}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="ghost" size="icon-sm" class={ICON_BUTTON} aria-label="More actions" data-testid="more-actions">
                <Ellipsis strokeWidth={1.7} />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" class="w-56">
            {#each slots.overflow as action (action.id)}
              {@const Icon = SELECTION_ACTION_ICON[action.id]}
              {@const gate = gateOf(action)}
              <DropdownMenu.Item class="min-h-11 md:min-h-8" disabled={!gate.enabled} title={gate.reason} onSelect={() => onaction?.(action.id)}>
                <Icon strokeWidth={1.7} />
                {action.label}
              </DropdownMenu.Item>
            {/each}
            {#if exportable}
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger class="min-h-11 md:min-h-8" data-testid="export-cloud-menu"><Cloud strokeWidth={1.7} />Export to cloud</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent class="z-50 w-48 rounded-md bg-ui-raised p-1 shadow-ui-float">
                  {#each CLOUD_PROVIDERS as provider (provider)}
                    <DropdownMenu.Item class="min-h-11 md:min-h-8" data-testid={`export-${provider}`} onSelect={() => onexportcloud?.(provider)}>{PROVIDER_LABEL[provider]}</DropdownMenu.Item>
                  {/each}
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
            {/if}
            {#if oncolourchange}
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger class="min-h-11 md:min-h-8" data-testid="colour-tag-menu"><span class="tag-dot" style={`--tag:${sharedColour ? COLOUR_TAG_HEX[sharedColour] : 'transparent'}`}></span>Colour tag</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent class="z-50 w-auto rounded-md bg-ui-raised p-2 shadow-ui-float">
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
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
            {/if}
            {#if slots.danger.length}
              <DropdownMenu.Separator />
              {#each slots.danger as action (action.id)}
                {@const Icon = SELECTION_ACTION_ICON[action.id]}
                <DropdownMenu.Item class="min-h-11 md:min-h-8" variant="destructive" data-testid={`action-${action.id}`} onSelect={() => onaction?.(action.id)}>
                  <Icon strokeWidth={1.7} />
                  {action.label}
                </DropdownMenu.Item>
              {/each}
            {/if}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
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
    gap: 8px;
    max-width: calc(100vw - 16px);
  }

  .toolbar.stacked {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .row:empty {
    display: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .group {
    min-height: 32px;
  }

  .group[aria-label='Actions'] {
    gap: 2px;
  }

  .toolbar :global(button[data-slot='tooltip-trigger']:not(.run)),
  .toolbar :global(button[data-slot='dropdown-menu-trigger']:not([data-control])) {
    border-radius: var(--ui-radius-sm);
  }

  .toolbar :global(button:disabled) {
    opacity: 0.35;
  }

  .run {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 9999px;
    color: var(--ui-on-accent);
    background: var(--ui-accent-solid);
    transition: background-color var(--ui-dur-fast, 120ms), color var(--ui-dur-fast, 120ms);
  }

  .run:hover {
    filter: brightness(1.1);
  }

  .run:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .run[data-run='blocked'] {
    cursor: not-allowed;
    color: var(--ui-text-3);
    background: var(--ui-wash);
    filter: none;
  }

  .run[data-run='running'] {
    color: var(--ui-text);
    background: var(--ui-wash);
  }

  .run-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    animation: run-spin 0.9s linear infinite;
  }

  .run-ring circle {
    fill: none;
    stroke: var(--ui-accent);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-dasharray: 22 66;
  }

  @keyframes run-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 767px) {
    .run {
      width: 44px;
      height: 44px;
    }
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
  }

  @media (max-width: 767px) {
    .group {
      flex: 1 1 auto;
      padding: 0;
    }
    .group[aria-label='Node properties'] {
      flex-basis: 100%;
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


  .warn {
    padding: 0 8px;
    font-size: 12px;
    line-height: 32px;
    color: var(--ui-text-3);
    white-space: nowrap;
  }

  .count {
    padding: 0 6px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--ui-text-secondary);
    white-space: nowrap;
  }
</style>
