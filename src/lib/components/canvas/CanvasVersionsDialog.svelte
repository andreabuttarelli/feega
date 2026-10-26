<script lang="ts">
  import type { CanvasVersion } from '$lib/server/canvas/canvas-versions';

  let { versions, onsave, onrestore, onclose }: { versions: CanvasVersion[] | null; onsave: (name: string) => void; onrestore: (version: CanvasVersion) => void; onclose: () => void } = $props();

  let name = $state('');

  const when = (iso: string) => new Date(iso).toLocaleString();

  function save(e: SubmitEvent) {
    e.preventDefault();
    onsave(name);
    name = '';
  }
</script>

<div class="vx-overlay" role="button" tabindex="-1" aria-label="Close" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="vx-card" role="dialog" aria-modal="true" aria-label="Canvas versions" data-testid="canvas-versions-dialog">
    <h3>Versions</h3>
    <form class="vx-save" onsubmit={save}>
      <input placeholder="Name this moment" aria-label="Version name" maxlength="60" bind:value={name} data-testid="canvas-version-name" />
      <button type="submit" class="vx-btn primary" data-testid="canvas-version-save">Save</button>
    </form>
    {#if versions === null}
      <p class="vx-note">Loading…</p>
    {:else if !versions.length}
      <p class="vx-note">No saved versions yet</p>
    {:else}
      <ul>
        {#each versions as v (v.id)}
          <li data-testid="canvas-version">
            <span class="vx-name">{v.name}</span>
            <span class="vx-meta">{when(v.createdAt)} · {v.nodes} nodes</span>
            <button type="button" class="vx-btn" data-testid="canvas-version-restore" onclick={() => onrestore(v)}>Restore</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .vx-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .vx-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 440px; max-height: 80vh; overflow: auto; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 10px; }
  .vx-card h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .vx-save { display: flex; gap: 8px; }
  .vx-save input { flex: 1; font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line, #e3e3e6); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  li { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line, #e3e3e6); }
  .vx-name { font-size: 13.5px; font-weight: 600; }
  .vx-meta { grid-column: 1; font-size: 12px; color: var(--ink-soft, #6e6e73); }
  li .vx-btn { grid-column: 2; grid-row: 1 / span 2; }
  .vx-note { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .vx-btn { font: inherit; font-size: 13px; font-weight: 600; padding: 6px 12px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); }
  .vx-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
</style>
