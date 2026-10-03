<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidate } from '$app/navigation';
  import PageHead from '$lib/components/PageHead.svelte';
  import { createSupabaseBrowserClient } from '$lib/supabase/client';
  import { watchBatch } from '$lib/realtime/batch-channel';

  let { data, form } = $props();

  const POLL_MS = 5000;
  const projectId = $derived(data.projectId);
  const dependency = $derived(`studio:batch:${data.batch.id}`);
  const pending = $derived(data.items.filter((i) => i.status === 'queued' || i.status === 'running').length);
  const queued = $derived(data.items.some((i) => i.status === 'queued'));
  const previewOnly = $derived(data.items.every((i) => i.preview));
  const approved = $derived(data.items.filter((i) => i.approval === 'approved').length);
  const failed = $derived(data.items.filter((i) => i.status === 'failed' || i.status === 'cancelled'));
  const counts = $derived(
    ['queued', 'running', 'done', 'failed', 'blocked', 'cancelled'].map((s) => [s, data.items.filter((i) => i.status === s).length] as const)
  );
  const failure = $derived(form && 'error' in form ? form.error : null);
  let more = $state(1);
  let draining = false;

  async function drain() {
    if (draining) {
      return;
    }
    draining = true;
    try {
      await fetch('?/drain', { method: 'POST', body: new FormData(), headers: { 'x-sveltekit-action': 'true' } });
    } finally {
      draining = false;
      await invalidate(dependency);
    }
  }

  $effect(() => {
    if (queued) {
      void drain();
    }
  });

  $effect(() => {
    const stop = watchBatch(createSupabaseBrowserClient(), data.batch.id, () => void invalidate(dependency));
    return stop;
  });

  $effect(() => {
    if (!pending) {
      return;
    }
    const timer = setInterval(() => void (queued ? drain() : invalidate(dependency)), POLL_MS);
    return () => clearInterval(timer);
  });
</script>

<div class="batch">
  <PageHead title={data.batch.name} subtitle={previewOnly ? 'Preview on the cheap model. Check consistency, then run the full batch.' : 'Live progress. Approve the photos you keep.'} />

  <div class="bar">
    {#each counts as [status, n]}
      {#if n}<span class={`badge ${status}`}>{status} {n}</span>{/if}
    {/each}
    <span class="muted">Balance {data.balance} credits</span>
  </div>

  <div class="bar">
    {#if previewOnly}
      <form method="POST" action="?/run" use:enhance>
        <button class="primary" type="submit" disabled={pending > 0}>Run full batch{data.perImage ? ` · ${data.perImage} credits per photo` : ''}</button>
      </form>
    {:else}
      <form method="POST" action="?/more" use:enhance class="inline">
        <input type="number" name="variations" min="1" max={data.maxVariations} bind:value={more} />
        <button type="submit">Generate more variations</button>
      </form>
    {/if}
    {#if pending}
      <form method="POST" action="?/cancel" use:enhance><button type="submit">Cancel queued</button></form>
    {/if}
    {#if failed.length}
      <form method="POST" action="?/retry" use:enhance>
        {#each failed as item (item.id)}<input type="hidden" name="itemId" value={item.id} />{/each}
        <button type="submit">Retry failed ({failed.length})</button>
      </form>
    {/if}
    <a class="link" href={`/app/studio?project=${projectId}`}>All batches</a>
    {#if data.batch.canvasId}<a class="link" href={`/p/${projectId}/c/${data.batch.canvasId}`}>Open canvas</a>{/if}
    {#if approved}<a class="link" href={`/app/studio/${data.batch.id}/zip`} download>Download approved ({approved})</a>{/if}
  </div>

  {#if data.batch.droppedRefs}<p class="warn">{data.batch.droppedRefs} style reference(s) were over the model's limit and are not sent.</p>{/if}
  {#if failure}<p class="error" role="alert">{failure}</p>{/if}

  <div class="grid" data-testid="studio-grid">
    {#each data.items as item (item.id)}
      <figure class={`cell ${item.status} ${item.approval}`}>
        {#if item.url}
          <img src={item.url} alt={item.productTitle} loading="lazy" />
        {:else}
          <div class="slot">{item.status}</div>
        {/if}
        <figcaption>
          <strong>{item.productTitle}</strong>
          <span>{item.environment} · {item.shot}{item.model ? ` · ${item.model}` : ''} · v{item.variation}{item.preview ? ' · preview' : ''}</span>
          {#if item.error}<span class="error">{item.error}</span>{/if}
        </figcaption>
        <div class="cell-actions">
          {#if item.status === 'done'}
            <form method="POST" action="?/approve" use:enhance><input type="hidden" name="itemId" value={item.id} /><button type="submit" class:on={item.approval === 'approved'}>Approve</button></form>
            <form method="POST" action="?/reject" use:enhance><input type="hidden" name="itemId" value={item.id} /><button type="submit" class:on={item.approval === 'rejected'}>Reject</button></form>
            <form method="POST" action="?/regenerate" use:enhance><input type="hidden" name="itemId" value={item.id} /><button type="submit">Regenerate</button></form>
          {/if}
        </div>
      </figure>
    {/each}
  </div>
</div>

<style>
  .batch { max-width: var(--content-max, 1100px); margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .bar button, .cell-actions button { padding: 6px 12px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--line-2, #d2d2d7); background: var(--paper, #fff); cursor: pointer; }
  .bar .primary { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .inline { display: flex; gap: 6px; }
  .inline input { width: 56px; padding: 4px 6px; border: 1px solid var(--line-2, #d2d2d7); }
  .link { font-size: 12.5px; text-decoration: underline; }
  .badge { font-size: 11.5px; padding: 3px 8px; border: 1px solid var(--line-2, #d2d2d7); }
  .badge.done { background: var(--ink); color: var(--paper); }
  .badge.failed, .badge.blocked { color: var(--danger, #c0392b); }
  .muted { color: var(--ink-3, #6e6e73); font-size: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .cell { margin: 0; border: 1px solid var(--line-2, #d2d2d7); display: flex; flex-direction: column; background: var(--paper, #fff); }
  .cell.approved { outline: 2px solid var(--ink); outline-offset: -2px; }
  .cell.rejected { opacity: 0.5; }
  .cell img, .slot { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }
  .slot { display: grid; place-items: center; font-size: 12px; color: var(--ink-3, #6e6e73); background: var(--paper-2, #f5f5f7); }
  .cell.running .slot { animation: pulse 1.2s ease-in-out infinite; }
  figcaption { display: flex; flex-direction: column; gap: 2px; padding: 6px; font-size: 11.5px; }
  .cell-actions { display: flex; gap: 4px; padding: 0 6px 6px; flex-wrap: wrap; }
  .cell-actions button { padding: 4px 8px; font-size: 11.5px; }
  .cell-actions .on { background: var(--ink); color: var(--paper); }
  .error { color: var(--danger, #c0392b); font-size: 12px; }
  .warn { color: var(--warn, #9a6700); font-size: 12.5px; }
  @keyframes pulse { 50% { opacity: 0.5; } }
</style>
