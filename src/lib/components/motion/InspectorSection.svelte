<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

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

<section class="section" data-section={section}>
  <div class="head">
    <button type="button" class="section-head" aria-expanded={open} onclick={ontoggle}>
      <span class="title">{title}</span>
      {#if !open && summary}<span class="summary">{summary}</span>{/if}
      <span class="chevron" aria-hidden="true">{#if open}<ChevronDown size={12} />{:else}<ChevronRight size={12} />{/if}</span>
    </button>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </div>
  {#if open}<div class="section-body">{@render children()}</div>{/if}
</section>

<style>
  .section + .section {
    border-top: 1px solid var(--ui-divider);
  }

  .head {
    display: flex;
    align-items: center;
    padding-right: var(--ui-space-2);
  }

  .section-head {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    gap: 8px;
    height: var(--ui-header-h);
    padding: 0 var(--ui-space-2) 0 var(--ui-space-4);
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    text-align: left;
    cursor: pointer;
  }

  .title {
    font-weight: 600;
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
    display: inline-flex;
    margin-left: auto;
    color: var(--ui-text-3);
  }

  .section-head:hover .chevron {
    color: var(--ui-text);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  @media (pointer: coarse) {
    .section-head {
      height: 44px;
    }
  }

  .section-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    padding: 0 var(--ui-space-4) var(--ui-space-4);
  }
</style>
