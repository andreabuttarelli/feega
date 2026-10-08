<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  let { title, open, section, summary = '', ontoggle, children }: { title: string; open: boolean; section: string; summary?: string; ontoggle: () => void; children: Snippet } = $props();
</script>

<section class="section" data-section={section}>
  <button type="button" class="section-head" aria-expanded={open} onclick={ontoggle}>
    {#if open}<ChevronDown size={12} />{:else}<ChevronRight size={12} />{/if}
    <span>{title}</span>
    {#if !open && summary}<span class="summary">{summary}</span>{/if}
  </button>
  {#if open}<div class="section-body">{@render children()}</div>{/if}
</section>

<style>
  .section + .section {
    margin-top: var(--ui-space-2);
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 40px;
    padding: 0 var(--ui-space-4);
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-text-3);
    font: inherit;
    font-size: var(--ui-text-xs);
    font-weight: 500;
    text-align: left;
    cursor: pointer;
  }

  .summary {
    min-width: 0;
    margin-left: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ui-text-2);
    font-weight: 400;
  }

  .section-head :global(svg) {
    color: var(--ui-ink-3);
  }

  @media (pointer: coarse) {
    .section-head {
      height: 44px;
    }
  }

  .section-head:hover {
    color: var(--ui-text-2);
  }

  .section-body {
    padding: 0 var(--ui-space-4) var(--ui-space-4);
  }
</style>
