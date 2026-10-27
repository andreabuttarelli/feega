<script lang="ts" module>
  export type LeftPanelKind = 'layers' | 'assets' | 'brands' | 'influencers';
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import ProjectDragPanel from './ProjectDragPanel.svelte';
  import InfluencersPanel from './InfluencersPanel.svelte';
  import BrandsPanel from './BrandsPanel.svelte';
  import LayersPanel from './LayersPanel.svelte';
  import ComponentsList from './ComponentsList.svelte';
  import X from '@lucide/svelte/icons/x';
  import { IconButton, IconSize, Side } from '$lib/components/ui/shell';
  import { PANEL_WIDTHS } from '$lib/shell-nav';

  /**
   * IL PANNELLO ACCANTO ALLA TELA — Assets, Brands o Influencers, uno alla volta (CLAUDE.md: "One
   * left panel at a time"). La tela resta interattiva dietro: non è un `Sheet`, è un riquadro non
   * modale che la rail apre e chiude, e da cui si trascina direttamente su `CanvasFlow`.
   *
   * `influencers` delega tutto — intestazione compresa — a `InfluencersPanel`, componente
   * autonomo con i propri filtri (genere/età/etnia) che `ProjectDragPanel` non ha: qui non si
   * ripete un'intestazione sopra un'altra.
   */
  let {
    projectId,
    kind,
    labelKey,
    onclose
  }: {
    projectId: string;
    kind: LeftPanelKind;
    labelKey: string;
    onclose: () => void;
  } = $props();


  const panelWidth = $derived(PANEL_WIDTHS[kind] ?? PANEL_WIDTHS.assets);
</script>

{#if kind === 'influencers'}
  <div class="left-panel" style={`width: min(${panelWidth}px, calc(100vw - 92px));`}>
    <InfluencersPanel {projectId} {onclose} />
  </div>
{:else}
  <div class="left-panel" style={`width: min(${panelWidth}px, calc(100vw - 92px));`}>
    <div class="left-panel-head">
      <h3>{$_(labelKey)}</h3>
      <IconButton label={$_('app.shell.closePanel')} shortcut="Escape" size={IconSize.Md} side={Side.Bottom} onclick={onclose}>
        <X />
      </IconButton>
    </div>
    <div class="left-panel-body">
      {#if kind === 'layers'}
        <LayersPanel />
      {:else if kind === 'brands'}
        <BrandsPanel {projectId} />
      {:else}
        <ComponentsList />
        <ProjectDragPanel {projectId} />
      {/if}
    </div>
  </div>
{/if}

<style>
  .left-panel {
    position: absolute;
    left: 68px;
    top: 56px;
    bottom: 12px;
    z-index: 30;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  @media (max-width: 1180px) {
    .left-panel {
      bottom: calc(var(--dock-lift, 0px) + 76px);
    }
  }

  .left-panel-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--ui-header-h);
    padding: 0 6px 0 12px;
  }
  .left-panel-head h3 {
    margin: 0;
    font-size: var(--ui-type-title);
    font-weight: var(--ui-weight-semibold);
    letter-spacing: var(--ui-tracking-title);
    color: var(--ui-text);
  }

  .left-panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px;
  }
</style>
