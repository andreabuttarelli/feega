<script lang="ts">
  import type { ChangeRow, Source } from '../messages';
  import GitCommit from './GitCommit.svelte';

  let { changes, onselect, onopen, ondiff, onrevert, onrevertall, onscm }: { changes: ChangeRow[]; onselect: (source: Source) => void; onopen: (source: Source) => void; ondiff: (id: number) => void; onrevert: (id: number) => void; onrevertall: () => void; onscm: () => void } = $props();

  const AT = /^(.+):(\d+):(\d+)$/;
  const sourceOf = (at: string): Source | null => {
    const m = at.match(AT);
    return m ? { file: m[1], line: Number(m[2]), col: Number(m[3]) } : null;
  };
  const files = $derived(new Set(changes.flatMap((c) => c.files)).size);
  const timeOf = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const shortAt = (at: string) => at.split('/').pop() ?? at;

  const ALL = -1;
  const REVERT_TIMEOUT_MS = 30_000;
  let reverting = $state<number | null>(null);
  let seen: ChangeRow[] | null = null;

  $effect(() => {
    if (changes !== seen) {
      seen = changes;
      reverting = null;
    }
  });

  $effect(() => {
    if (reverting === null) {
      return;
    }
    const timer = setTimeout(() => (reverting = null), REVERT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  });

  function revert(id: number) {
    reverting = id;
    if (id === ALL) {
      onrevertall();
      return;
    }
    onrevert(id);
  }
</script>

{#snippet spinner()}<span class="spinner" aria-hidden="true"></span>{/snippet}

<div class="changes" data-testid="changes">
  <header>
    <span>{files} {files === 1 ? 'file' : 'files'} changed</span>
    <button type="button" class="link" onclick={onscm}>Source Control</button>
    <button type="button" class="link danger" disabled={!changes.length || reverting !== null} aria-busy={reverting === ALL} onclick={() => revert(ALL)}>{#if reverting === ALL}{@render spinner()}Reverting…{:else}Revert all{/if}</button>
  </header>
  <GitCommit {changes} />
  {#if !changes.length}<p class="empty">No edits yet in this workspace.</p>{/if}
  {#each changes as change (change.id)}
    {@const source = sourceOf(change.at)}
    <div class="row">
      <button type="button" class="what" onclick={() => source && onselect(source)}>
        <strong>{change.prop}</strong>
        <span class="value">{change.value}</span>
        <span class="meta">{shortAt(change.at)}{change.scope ? ` · ${change.scope}` : ''} · {timeOf(change.time)}{change.by ? ` · by ${change.by}` : ''}</span>
      </button>
      <div class="actions">
        {#if source}<button type="button" class="link" onclick={() => onopen(source)}>Open</button>{/if}
        <button type="button" class="link" onclick={() => ondiff(change.id)}>Show diff</button>
        <button type="button" class="link" disabled={reverting !== null} aria-busy={reverting === change.id} onclick={() => revert(change.id)}>{#if reverting === change.id}{@render spinner()}Reverting…{:else}Revert{/if}</button>
      </div>
    </div>
  {/each}
</div>

<style>
  .changes {
    display: flex;
    flex-direction: column;
    font-size: var(--ui-text-sm);
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-divider);
    color: var(--ui-text-2);
  }

  header span {
    flex: 1;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-divider);
  }

  .what {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .value {
    overflow: hidden;
    max-width: 140px;
    color: var(--ui-text-2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    width: 100%;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-accent);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 6px;
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    border-radius: var(--ui-radius-full);
    vertical-align: -1px;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .link[aria-busy='true']:disabled {
    opacity: 1;
  }

  .link:disabled {
    color: var(--ui-text-3);
    cursor: default;
  }

  .danger {
    color: #ff453a;
  }

  .empty {
    padding: 12px;
    color: var(--ui-text-2);
  }
</style>
