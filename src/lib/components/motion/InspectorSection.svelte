<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  let { title, open, section, ontoggle, children }: { title: string; open: boolean; section: string; ontoggle: () => void; children: Snippet } = $props();
</script>

<section class="section" data-section={section}>
  <button type="button" class="section-head" aria-expanded={open} onclick={ontoggle}>
    {#if open}<ChevronDown size={12} />{:else}<ChevronRight size={12} />{/if}
    <span>{title}</span>
  </button>
  {#if open}<div class="section-body">{@render children()}</div>{/if}
</section>

<style>
  .section {
    border-bottom: 1px solid var(--ui-line);
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 32px;
    padding: 0 12px 0 8px;
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    font-weight: 600;
    text-align: left;
    cursor: pointer;
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
    background: var(--ui-hover);
  }

  .section-body {
    padding: 2px 12px 12px;
  }
</style>
