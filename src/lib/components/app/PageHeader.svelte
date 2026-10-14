<script lang="ts">
  import type { Snippet } from 'svelte';
  import PageTitle from '$lib/components/PageTitle.svelte';

  let { title, lede, actions }: { title: string; lede?: string; actions?: Snippet } = $props();
</script>

<header class="page-header" data-slot="page-header">
  <div class="words">
    <PageTitle text={title} />
    {#if lede}<p>{lede}</p>{/if}
  </div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
  .page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--ui-space-4);
  }

  .words {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    min-width: 0;
  }

  p {
    margin: 0;
    max-width: 56ch;
    font-size: var(--ui-type-body);
    line-height: var(--ui-leading);
    color: var(--ui-text-tertiary);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
  }
</style>
