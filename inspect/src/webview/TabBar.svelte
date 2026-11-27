<script lang="ts">
  import './tab-bar.css';
  import { ViewKind, type ViewTab } from './views';

  type Props = { tabs: ViewTab[]; onselect: (kind: ViewKind) => void; onclose: (kind: ViewKind) => void; height?: number };

  let { tabs, onselect, onclose, height = $bindable(0) }: Props = $props();
</script>

<header class="tab-bar row" role="tablist" aria-label="Views" data-testid="view-tabs" bind:clientHeight={height}>
  {#each tabs as tab (tab.id)}
    <button type="button" role="tab" aria-selected={tab.active} class="tab fresh" class:view={tab.kind !== ViewKind.Editor} class:on={tab.active} data-testid={`view-${tab.id}`} onclick={() => onselect(tab.kind)}>
      {#if tab.kind === ViewKind.Editor}<span class="dot ready"></span>{/if}
      <span class="name">{tab.title}</span>
      {#if tab.closable}
        <span class="x" role="button" tabindex="-1" title="close" aria-label={`Close ${tab.title}`} data-testid={`view-close-${tab.id}`} onclick={(event) => (event.stopPropagation(), onclose(tab.kind))} onkeydown={(event) => event.key === 'Enter' && (event.stopPropagation(), onclose(tab.kind))}>
          <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7" /></svg>
        </span>
      {/if}
    </button>
  {/each}
</header>

<style>
  .row {
    height: 52px;
    box-sizing: border-box;
    padding: 0 14px;
    background: #121212;
  }
</style>
