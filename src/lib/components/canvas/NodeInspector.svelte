<script lang="ts">
  import { genPropertiesOf } from '$lib/canvas/gen-properties';
  import { PROVIDER_PARAM } from '$lib/canvas/model-routes';
  import AlignBar from '$lib/components/motion/AlignBar.svelte';
  import ModelMenu from './ModelMenu.svelte';
  import NodeSettings from './NodeSettings.svelte';
  import type { SelectionPanel } from './selection-properties.svelte';

  const MIN_ALIGNED = 2;

  let { panel }: { panel: SelectionPanel } = $props();

  const gen = $derived(genPropertiesOf(panel.summaries, panel.choicesFor));
</script>

<aside class="node-inspector" data-testid="node-inspector" aria-label="Properties">
  {#if gen.properties.type}
    <section class="block" aria-label="Model">
      <h3>Model</h3>
      <ModelMenu
        choices={gen.choices}
        value={gen.modelValue}
        provider={gen.providerValue}
        mixed={gen.properties.model.kind === 'mixed'}
        medium={panel.runQuote?.cost.medium ?? null}
        params={panel.runQuote?.cost.params ?? {}}
        onselect={(id, provider) => panel.onpropertychange({ model: id || null, dynamicParams: { [PROVIDER_PARAM]: provider } })}
      />
      {#if gen.controls.length}
        <NodeSettings controls={gen.controls} onchange={(patch) => panel.onpropertychange(patch)} />
      {/if}
    </section>
  {/if}

  {#if panel.summaries.length >= MIN_ALIGNED}
    <section class="block" aria-label="Align">
      <h3>Align</h3>
      <AlignBar count={panel.summaries.length} onalign={panel.onalign} ondistribute={(axis) => panel.ondistribute(axis)} />
    </section>
  {/if}
</aside>

<style>
  .node-inspector {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-bottom: 1px solid var(--ui-line);
  }

  h3 {
    margin: 0;
    font-size: var(--ui-type-caption);
    font-weight: 600;
    color: var(--ui-text-secondary);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    min-height: 32px;
    padding: 0 var(--ui-space-2);
    border-radius: var(--ui-radius-sm);
    font-size: var(--ui-type-caption);
    color: var(--ui-text);
    text-align: left;
  }

  .row:hover {
    background: var(--ui-wash);
  }

  @media (max-width: 767px) {
    .row {
      min-height: 44px;
    }
  }
</style>
