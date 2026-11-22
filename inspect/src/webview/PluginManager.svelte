<script lang="ts">
  import type { Row } from './plugin-manager';

  let { rows, problems, canInstall, onenable, onremove, oninstall }: { rows: Row[]; problems: string[]; canInstall: boolean; onenable: (id: string, enabled: boolean) => void; onremove: (id: string) => void; oninstall: (source: string) => void } = $props();

  let source = $state('');

  function install() {
    const text = source.trim();
    if (text) {
      oninstall(text);
      source = '';
    }
  }
</script>

<div class="manager" data-testid="plugin-manager">
  {#each rows as row (row.id)}
    <div class="plugin" data-testid="plugin-row" data-plugin={row.id}>
      <label class="head">
        <span class="name">{row.name}<span class="version">{row.version}</span></span>
        <input type="checkbox" checked={row.enabled} aria-label={`Enable ${row.name}`} onchange={(e) => onenable(row.id, e.currentTarget.checked)} />
      </label>
      {#if row.badges.length}
        <div class="badges">{#each row.badges as badge (badge)}<span class="badge" data-testid="plugin-badge">{badge}</span>{/each}</div>
      {/if}
      <details>
        <summary>Permissions</summary>
        {#if row.words.length}
          <ul>{#each row.words as word (word)}<li>{word}</li>{/each}</ul>
        {:else}
          <p class="hint">None.</p>
        {/if}
      </details>
      {#if row.removable}<button type="button" class="remove" data-testid="plugin-remove" onclick={() => onremove(row.id)}>Remove</button>{/if}
    </div>
  {/each}

  {#each problems as problem (problem)}<p class="problem">{problem}</p>{/each}

  {#if canInstall}
    <form class="install" onsubmit={(e) => (e.preventDefault(), install())}>
      <input type="text" bind:value={source} placeholder="github:owner/repo@tag or npm name" aria-label="Plugin source" data-testid="plugin-source" />
      <button type="submit">Install</button>
    </form>
  {:else}
    <p class="hint">Install from a terminal: npx feega plugin add github:owner/repo</p>
  {/if}
</div>

<style>
  .manager {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: 0 8px;
    font-size: var(--ui-text-sm);
  }

  .plugin {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
    min-height: 24px;
  }

  .version {
    margin-left: 6px;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .badges {
    display: flex;
    gap: 4px;
  }

  .badge {
    padding: 0 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  summary {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  ul {
    margin: 2px 0 0;
    padding-left: 16px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .remove,
  .install button {
    align-self: flex-start;
    height: 22px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .install {
    display: flex;
    gap: 4px;
  }

  .install input {
    flex: 1;
    min-width: 0;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
  }

  .hint,
  .problem {
    margin: 0;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .problem {
    color: var(--ui-text-2);
  }
</style>
