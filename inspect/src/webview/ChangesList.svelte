<script lang="ts">
  import type { ChangeRow, Source } from '../messages';

  let { changes, onselect, ondiff, onrevert, onrevertall, onscm }: { changes: ChangeRow[]; onselect: (source: Source) => void; ondiff: (id: number) => void; onrevert: (id: number) => void; onrevertall: () => void; onscm: () => void } = $props();

  const AT = /^(.+):(\d+):(\d+)$/;
  const sourceOf = (at: string): Source | null => {
    const m = at.match(AT);
    return m ? { file: m[1], line: Number(m[2]), col: Number(m[3]) } : null;
  };
  const files = $derived(new Set(changes.flatMap((c) => c.files)).size);
  const timeOf = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const shortAt = (at: string) => at.split('/').pop() ?? at;
</script>

<div class="changes" data-testid="changes">
  <header>
    <span>{files} {files === 1 ? 'file' : 'files'} changed</span>
    <button type="button" class="link" onclick={onscm}>Source Control</button>
    <button type="button" class="link danger" disabled={!changes.length} onclick={onrevertall}>Revert all</button>
  </header>
  {#if !changes.length}<p class="empty">No edits yet in this workspace.</p>{/if}
  {#each changes as change (change.id)}
    {@const source = sourceOf(change.at)}
    <div class="row">
      <button type="button" class="what" onclick={() => source && onselect(source)}>
        <strong>{change.prop}</strong>
        <span class="value">{change.value}</span>
        <span class="meta">{shortAt(change.at)}{change.scope ? ` · ${change.scope}` : ''} · {timeOf(change.time)}</span>
      </button>
      <div class="actions">
        <button type="button" class="link" onclick={() => ondiff(change.id)}>Show diff</button>
        <button type="button" class="link" onclick={() => onrevert(change.id)}>Revert</button>
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
