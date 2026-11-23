<script lang="ts">
  import type { Held } from './preview-gate';

  type Props = { held: Held; onapply: () => void; oncancel: () => void; onmute: () => void };

  let { held, onapply, oncancel, onmute }: Props = $props();
</script>

<div class="preview" role="alertdialog" aria-label="Preview of the edit" data-testid="impact-preview">
  <span class="why">Impact unknown: {held.reason}</span>
  {#each held.files as file (file.path)}
    <div class="file">{file.path}:{file.line}</div>
    <pre class="diff">{#each file.removed as line, i (i)}<span class="del">- {line}</span>{'\n'}{/each}{#each file.added as line, i (i)}<span class="add">+ {line}</span>{'\n'}{/each}{#if file.more}<span class="more">… {file.more} more lines</span>{/if}</pre>
  {/each}
  <div class="actions">
    <button type="button" class="primary" data-action="preview-apply" onclick={onapply}>Apply</button>
    <button type="button" data-action="preview-cancel" onclick={oncancel}>Cancel</button>
    <button type="button" class="link" data-action="preview-mute" onclick={onmute}>Don't ask again</button>
  </div>
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0 12px 8px;
    padding: 6px 8px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    font-size: var(--ui-text-xs);
    color: var(--ui-text);
  }

  .why {
    color: var(--ui-text-2);
  }

  .file {
    color: var(--ui-text-2);
  }

  .diff {
    margin: 0;
    overflow-x: auto;
    font-family: var(--ui-mono, monospace);
    font-size: var(--ui-text-xs);
  }

  .del {
    color: var(--ui-danger, #d33);
  }

  .add {
    color: var(--ui-success, #2a9d4a);
  }

  .more {
    color: var(--ui-text-3);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  button {
    border: 0;
    background: none;
    padding: 0;
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }

  .primary,
  .link {
    color: var(--ui-accent);
  }
</style>
