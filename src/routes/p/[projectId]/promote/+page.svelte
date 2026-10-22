<script lang="ts">
  import { page } from '$app/state';
  import PaidAdForm from '$lib/components/promote/PaidAdForm.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData; form?: unknown } = $props();

  const projectId = $derived(page.params.projectId ?? '');
</script>

<div class="promote">
  <header>
    <h1>Promote</h1>
    <p>{data.nodes.length ? `${data.nodes.length} selected on the canvas` : 'Nothing selected on the canvas'}</p>
  </header>

  <PaidAdForm {projectId} {data} />
</div>

<style>
  .promote { padding: 32px; max-width: 880px; margin: 0 auto; }
  header h1 { font-size: 20px; margin: 0; }
  header p { margin: 4px 0 0; font-size: 13px; color: var(--ink-faint, #9a9a9e); }
  :global([data-viewport='mobile']) .promote { padding: 20px var(--page-gutter, 16px) 32px; }
</style>
