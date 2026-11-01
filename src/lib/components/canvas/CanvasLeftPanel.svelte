<script lang="ts" module>
  export type LeftPanelKind = 'layers' | 'assets' | 'brands' | 'influencers' | 'components' | 'history' | 'styles';
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import ProjectDragPanel from './ProjectDragPanel.svelte';
  import InfluencersPanel from './InfluencersPanel.svelte';
  import BrandsPanel from './BrandsPanel.svelte';
  import LayersPanel from './LayersPanel.svelte';
  import PagesList from './PagesList.svelte';
  import type { ComponentProps } from 'svelte';
  import ProjectComponentsPanel from './ProjectComponentsPanel.svelte';
  import HistoryPanel from './HistoryPanel.svelte';
  import StyleLibrarySection from '$lib/components/motion/StyleLibrarySection.svelte';
  import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
  import X from '@lucide/svelte/icons/x';
  import Search from '@lucide/svelte/icons/search';
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
    pages,
    onclose
  }: {
    projectId: string;
    kind: LeftPanelKind;
    labelKey: string;
    pages: ComponentProps<typeof PagesList>;
    onclose: () => void;
  } = $props();


  const SECTION_ICON = 14;
  let searching = $state(false);

  const panelWidth = $derived(PANEL_WIDTHS[kind] ?? PANEL_WIDTHS.assets);
</script>

{#if kind === 'influencers'}
  <div class="left-panel" style={`width: min(${panelWidth}px, calc(100vw - 92px));`}>
    <InfluencersPanel {projectId} {onclose} />
  </div>
{:else if kind === 'layers'}
  <div class="left-panel is-tree" style={`width: min(${panelWidth}px, calc(100vw - 92px));`} data-testid="pages-layers">
    <PagesList {...pages} />
    <div class="section-head">
      <span class="section-label">{$_(labelKey)}</span>
      <button type="button" class="section-icon" class:on={searching} data-testid="layers-search-toggle" aria-label="Search layers" aria-pressed={searching} onclick={() => (searching = !searching)}>
        <Search size={SECTION_ICON} />
      </button>
    </div>
    <div class="left-panel-body">
      <LayersPanel {searching} />
    </div>
  </div>
{:else}
  <div class="left-panel" style={`width: min(${panelWidth}px, calc(100vw - 92px));`}>
    <div class="section-head is-first">
      <span class="section-label">{$_(labelKey)}</span>
      <IconButton label={$_('app.shell.closePanel')} shortcut="Escape" size={IconSize.Sm} side={Side.Bottom} onclick={onclose} data-testid="panel-close">
        <X />
      </IconButton>
    </div>
    <div class="left-panel-body is-flush">
      {#if kind === 'components'}
        <ProjectComponentsPanel {projectId} />
      {:else if kind === 'styles'}
        <StyleLibrarySection tokens={FEEGA_TOKENS} />
      {:else if kind === 'history'}
        {#if pages.currentId}
          <HistoryPanel {projectId} canvasId={pages.currentId} />
        {/if}
      {:else if kind === 'brands'}
        <BrandsPanel {projectId} />
      {:else}
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

  .left-panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 6px;
  }

  .is-tree .left-panel-body,
  .left-panel-body.is-flush {
    padding: 0 6px 6px;
  }

  .section-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    height: var(--ui-row-sm);
    margin-top: 4px;
    padding: 0 6px 0 14px;
  }

  .section-head.is-first {
    margin-top: 0;
    height: var(--ui-header-h);
  }

  .section-label {
    flex: 1 1 auto;
    font-size: 11px;
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text-secondary);
  }

  .section-icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
  }

  .section-icon:hover,
  .section-icon.on {
    background: var(--ui-hover);
    color: var(--ui-text);
  }
</style>
