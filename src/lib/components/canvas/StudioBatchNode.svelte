<script lang="ts">
  import Camera from '@lucide/svelte/icons/camera';
  import type { StudioBatchCard, StudioBatchNode } from '$lib/canvas/studio-batch-node';

  type BatchOption = { id: string; name: string; status: string };

  let { node, projectId, onpick }: { node: StudioBatchNode; projectId: string; onpick: (batchId: string | null) => void } = $props();

  const REFRESH_MS = 10000;

  let card = $state<StudioBatchCard | null>(null);
  let options = $state<BatchOption[] | null>(null);
  let failed = $state(false);

  async function fetchJson<T>(url: string): Promise<T | null> {
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) {
      failed = true;
      return null;
    }
    failed = false;
    return (await response.json()) as T;
  }

  $effect(() => {
    const batchId = node.batchId;
    if (!batchId) {
      card = null;
      void fetchJson<BatchOption[]>(`/app/studio/cards?project=${projectId}`).then((list) => (options = list));
      return;
    }

    const refresh = () => void fetchJson<StudioBatchCard>(`/app/studio/${batchId}/card`).then((next) => (card = next));
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  });
</script>

<div class="studio-batch" data-testid="studio-batch-node">
  {#if !node.batchId}
    <div class="pick">
      <Camera size={22} strokeWidth={1.5} />
      {#if options?.length}
        <label class="nodrag">
          <span>Show a Photo studio batch</span>
          <select onchange={(e) => onpick(e.currentTarget.value || null)}>
            <option value="">Pick a batch…</option>
            {#each options as option (option.id)}
              <option value={option.id}>{option.name} · {option.status}</option>
            {/each}
          </select>
        </label>
      {:else if options}
        <span class="muted">No batches in this project yet.</span>
      {/if}
      <a class="link nodrag" href={`/app/studio?project=${projectId}`}>Open Photo studio</a>
    </div>
  {:else if card}
    <div class="thumbs" data-count={card.thumbs.length}>
      {#each card.thumbs as thumb (thumb)}
        <img src={thumb} alt="" loading="lazy" />
      {:else}
        <span class="empty"><Camera size={22} strokeWidth={1.5} /></span>
      {/each}
    </div>
    <div class="foot">
      <span class="counts">
        <strong>{card.approved}</strong> approved · {card.done}/{card.total} done{#if card.running} · {card.running} running{/if}{#if card.failed} · {card.failed} failed{/if}
      </span>
      <span class="actions">
        <button type="button" class="link nodrag" onclick={() => onpick(null)}>Change</button>
        <a class="open nodrag" href={card.href}>Open batch</a>
      </span>
    </div>
  {:else if failed}
    <div class="pick">
      <span class="muted">This batch is not reachable.</span>
      <button type="button" class="link nodrag" onclick={() => onpick(null)}>Pick another</button>
    </div>
  {/if}
</div>

<style>
  .studio-batch {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--paper);
    font-size: 12px;
  }

  .pick {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px;
    color: var(--ink-soft);
  }

  .pick label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .pick select {
    height: 30px;
    border: 1px solid var(--line-2);
    background: var(--paper);
    color: var(--ink);
  }

  .thumbs {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 1fr;
    gap: 1px;
    background: var(--line);
  }

  .thumbs img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .empty {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--paper-3);
    color: var(--ink-faint);
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 44px;
    padding: 0 10px;
    border-top: 1px solid var(--line);
  }

  .counts {
    color: var(--ink-soft);
  }

  .counts strong {
    color: var(--ink);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .link {
    border: 0;
    background: none;
    padding: 0;
    color: var(--ink-soft);
    text-decoration: underline;
    cursor: pointer;
    font-size: 12px;
  }

  .open {
    padding: 6px 12px;
    background: var(--ink);
    color: var(--paper);
    text-decoration: none;
    white-space: nowrap;
  }

  .muted {
    color: var(--ink-soft);
  }
</style>
