<script lang="ts">
  import { page } from '$app/state';
  import OrganicPostForm from '$lib/components/promote/OrganicPostForm.svelte';
  import PaidAdForm from '$lib/components/promote/PaidAdForm.svelte';
  import { promoteTabsFor, type PromoteTab } from '$lib/canvas/promote-sheet';
  import type { PageData } from './$types';

  let { data, form = null }: { data: PageData; form?: unknown } = $props();

  const projectId = $derived(page.params.projectId ?? '');
  let tab = $state<PromoteTab>(data.tab);
</script>

<div class="promote">
  <header>
    <h1>Promote</h1>
    <p>{data.nodes.length ? `${data.nodes.length} selected on the canvas` : 'Nothing selected on the canvas'}</p>
  </header>

  <div class="tabs" role="tablist">
    {#each promoteTabsFor(page.data.socialPublishing) as t (t.id)}
      <button type="button" role="tab" aria-selected={tab === t.id} class:on={tab === t.id} onclick={() => (tab = t.id)}>
        {t.label}
      </button>
    {/each}
  </div>

  {#if tab === 'organic'}
    <OrganicPostForm {data} {form} />
  {:else}
    <PaidAdForm {projectId} {data} />
  {/if}
</div>

<style>
  .promote { padding: 32px; max-width: 880px; margin: 0 auto; }
  header h1 { font-size: 20px; margin: 0; }
  header p { margin: 4px 0 0; font-size: 13px; color: var(--ink-faint, #9a9a9e); }
  .tabs { display: flex; gap: 0; margin: 20px 0 24px; border-bottom: 1px solid var(--line, #e5e5e5); }
  .tabs button {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 10px 14px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
    margin-bottom: -1px;
  }
  .tabs button.on { color: var(--ink, #1d1d1f); border-bottom-color: var(--ink, #1d1d1f); }
  :global([data-viewport='mobile']) .promote { padding: 20px var(--page-gutter, 16px) 32px; }
  :global([data-viewport='mobile']) .tabs button { flex: 1; min-height: var(--touch-target, 44px); }
</style>
