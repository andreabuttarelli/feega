<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  let { title, open, section, summary = '', ontoggle, children }: { title: string; open: boolean; section: string; summary?: string; ontoggle: () => void; children: Snippet } = $props();
</script>

<section class="section" data-section={section}>
  <button type="button" class="section-head" aria-expanded={open} onclick={ontoggle}>
    <span class="title">{title}</span>
    {#if !open && summary}<span class="summary">{summary}</span>{/if}
    <span class="chevron" aria-hidden="true">{#if open}<ChevronDown size={12} />{:else}<ChevronRight size={12} />{/if}</span>
  </button>
  {#if open}<div class="section-body">{@render children()}</div>{/if}
</section>

<style>
  .section + .section {
    border-top: 1px solid var(--ui-line);
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 36px;
    padding: 0 var(--ui-space-4);
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
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
    color: var(--ui-ink-3);
  }

  .chevron {
    display: inline-flex;
    margin-left: auto;
    color: var(--ui-ink-3);
  }

  .section-head:hover .chevron {
    color: var(--ui-ink);
  }

  @media (pointer: coarse) {
    .section-head {
      height: 44px;
    }
  }

  .section-body {
    display: grid;
    gap: 6px;
    padding: 0 var(--ui-space-4) var(--ui-space-4);
  }
</style>
