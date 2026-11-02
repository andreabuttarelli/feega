<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  let {
    title,
    open,
    section,
    summary = '',
    ontoggle,
    actions,
    children
  }: { title: string; open: boolean; section: string; summary?: string; ontoggle: () => void; actions?: Snippet; children: Snippet } = $props();
</script>

<section class="section ui-section" data-section={section} data-open={open}>
  <div class="head">
    <button type="button" class="section-head" aria-expanded={open} onclick={ontoggle}>
      <span class="title">{title}</span>
      {#if !open && summary}<span class="summary">{summary}</span>{/if}
    </button>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
    <span class="chevron" aria-hidden="true"><ChevronDown size={14} /></span>
  </div>
  {#if open}<div class="section-body">{@render children()}</div>{/if}
</section>

<style>
  .head {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    padding-right: var(--ui-space-2);
  }

  .section-head {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: var(--ui-space-2);
    height: var(--ui-header-h);
    padding: 0 var(--ui-space-2) 0 var(--ui-space-4);
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-md);
    text-align: left;
    cursor: pointer;
  }

  .section-head::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .title {
    font-weight: 600;
    letter-spacing: -0.005em;
  }

  [data-open='false'] .title {
    color: var(--ui-text-2);
  }

  .section-head:hover .title {
    color: var(--ui-text);
  }

  .summary {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .chevron {
    display: inline-grid;
    place-items: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    color: var(--ui-text-3);
    pointer-events: none;
    transition: transform var(--ui-dur-fast, 120ms) ease;
  }

  [data-open='false'] .chevron {
    transform: rotate(-90deg);
  }

  .head:hover .chevron {
    color: var(--ui-text);
  }

  .actions {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 2px;
    color: var(--ui-text-2);
  }

  @media (pointer: coarse) {
    .section-head {
      height: 44px;
    }

    .chevron {
      width: 44px;
      height: 44px;
    }
  }

  .section-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-space-2);
    padding: 0 var(--ui-space-4) var(--ui-space-4);
  }
</style>
