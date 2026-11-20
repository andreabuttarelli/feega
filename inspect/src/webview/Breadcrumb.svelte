<script lang="ts">
  import type { Pick, Source } from '../messages';
  import { crumbsOf } from './crumbs';
  import { ElementState } from '@feega/live-edit/element-state';

  let { pick, onselect, compact = false, state = ElementState.Default }: { pick: Pick; onselect: (source: Source) => void; compact?: boolean; state?: ElementState } = $props();

  const crumbs = $derived(crumbsOf(pick, undefined, state));
</script>

<nav class="crumbs" class:compact aria-label="Selection path" data-testid="breadcrumb">
  {#each crumbs as crumb, i (i)}
    {#if i > 0}<span class="sep" aria-hidden="true">›</span>{/if}
    {#if crumb.source && i < crumbs.length - 1}
      <button type="button" onclick={(e) => (e.stopPropagation(), onselect(crumb.source!))}>{crumb.name}</button>
    {:else}
      <span class:current={crumb.source}>{crumb.name}</span>
    {/if}
    {#if crumb.badge}<span class="state-badge" data-testid="state-badge">{crumb.badge}</span>{/if}
  {/each}
</nav>

<style>
  .crumbs {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    overflow: hidden;
    font-size: var(--ui-text-xs);
    white-space: nowrap;
  }

  .sep {
    color: var(--ui-text-3);
  }

  button {
    padding: 0 2px;
    border: 0;
    border-radius: var(--ui-radius-xs);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    color: var(--ui-text);
    text-decoration: underline;
  }

  .state-badge {
    padding: 0 4px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font-size: 10px;
    line-height: 14px;
  }

  .compact .state-badge {
    background: var(--ui-accent-ink);
    color: var(--ui-accent);
  }

  .current {
    color: var(--ui-text);
    font-weight: 600;
  }

  .compact,
  .compact button,
  .compact .current,
  .compact .sep {
    color: var(--ui-accent-ink);
  }

  .compact {
    pointer-events: auto;
  }
</style>
