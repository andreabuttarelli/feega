<script lang="ts">
  import { onMount } from 'svelte';
  import type { Conflict } from '@feega/canvas-folder';
  import { conflictTitle, shownValue, unsavedLine } from '$lib/canvas/folder-sync';

  type Status = { relation: string; notice: string | null; conflicts: Conflict[]; unsavedSince: string | null; failedAssets: string[] };

  let { names }: { names: Record<string, string> } = $props();

  const ENDPOINT = '/local/folder';
  const POLL_MS = 5000;

  let status = $state<Status | null>(null);
  let dismissed = $state(false);
  let busy = $state(false);

  const shown = $derived(status && (status.conflicts.length > 0 || status.unsavedSince || status.failedAssets.length > 0 || (status.notice && !dismissed)));

  async function load() {
    const response = await fetch(ENDPOINT).catch(() => null);
    status = response?.ok ? await response.json() : null;
  }

  async function keep(conflict: Conflict, side: 'mine' | 'theirs') {
    busy = true;
    const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conflict, keep: side }) });
    busy = false;
    if (side === 'theirs' && response.ok) {
      location.reload();
      return;
    }
    status = response.ok ? await response.json() : status;
  }

  onMount(() => {
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  });
</script>

{#if status && shown}
  <div class="folder-sync rounded-lg" role="status" data-testid="folder-sync">
    {#if status.unsavedSince}
      <p class="warn" data-testid="folder-unsaved">{unsavedLine(status.unsavedSince)}</p>
    {/if}
    {#if status.notice && !dismissed}
      <div class="head">
        <p>{status.notice}</p>
        <button type="button" class="close" aria-label="Dismiss" onclick={() => (dismissed = true)}>×</button>
      </div>
    {/if}
    {#if status.failedAssets.length}
      <details>
        <summary>{status.failedAssets.length} media could not be saved into .feega/assets</summary>
        <ul class="failed">
          {#each status.failedAssets as url (url)}
            <li>{url}</li>
          {/each}
        </ul>
      </details>
    {/if}
    {#if status.conflicts.length}
      <h4>{status.conflicts.length} {status.conflicts.length === 1 ? 'conflict' : 'conflicts'}</h4>
      <ul class="conflicts" data-testid="folder-conflicts">
        {#each status.conflicts as conflict (`${conflict.collection}/${conflict.id}/${conflict.field}`)}
          <li class="rounded-md">
            <p class="title">{conflictTitle(conflict, names)}</p>
            <dl>
              <dt>Mine</dt>
              <dd>{shownValue(conflict.ours)}</dd>
              <dt>Theirs</dt>
              <dd>{shownValue(conflict.theirs)}</dd>
            </dl>
            <div class="actions">
              <button type="button" class="rounded-sm" disabled={busy} onclick={() => keep(conflict, 'mine')}>Keep mine</button>
              <button type="button" class="rounded-sm" disabled={busy} onclick={() => keep(conflict, 'theirs')}>Keep theirs</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .folder-sync {
    position: absolute;
    z-index: 10;
    right: 16px;
    top: calc(var(--chrome-top, 10px) + 52px);
    width: min(340px, calc(100% - 32px));
    max-height: 60vh;
    overflow-y: auto;
    padding: 10px 12px;
    font-size: var(--ui-text-sm);
    color: var(--ui-text);
    background: var(--ui-panel-raised);
    border: 1px solid var(--ui-line);
    box-shadow: var(--ui-shadow-raised);
  }

  p {
    margin: 0;
  }

  .warn {
    margin-bottom: 6px;
    font-weight: 500;
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .head p {
    flex: 1;
  }

  .close {
    border: 0;
    background: none;
    color: var(--ui-text-secondary);
    cursor: pointer;
  }

  summary {
    margin-top: 6px;
    color: var(--ui-text-secondary);
    cursor: pointer;
  }

  h4 {
    margin: 10px 0 6px;
    font-size: var(--ui-text-xs);
    color: var(--ui-text-secondary);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .failed {
    padding-left: 12px;
    color: var(--ui-text-secondary);
    word-break: break-all;
  }

  .conflicts li {
    padding: 8px;
    margin-bottom: 6px;
    border: 1px solid var(--ui-line);
  }

  .title {
    font-weight: 500;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 8px;
    margin: 6px 0;
  }

  dt {
    color: var(--ui-text-secondary);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .actions button {
    padding: 4px 8px;
    font: inherit;
    color: var(--ui-text);
    background: var(--ui-panel);
    border: 1px solid var(--ui-line);
    cursor: pointer;
  }
</style>
