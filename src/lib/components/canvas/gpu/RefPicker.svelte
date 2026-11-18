<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { refChoices } from '$lib/canvas/ref-choices';
  import { compareRefs, versionsOf } from '$lib/canvas/version-client';

  type Anchor = { left: number; top: number };

  let { projectId, nodeId, anchor, onclose, oncompared }: { projectId: string; nodeId: string; anchor: Anchor; onclose: () => void; oncompared: (frameIds: string[]) => void } = $props();

  const MAX_PICKED = 4;

  let groups = $state<ReturnType<typeof refChoices> | null>(null);
  let busy = $state(false);
  let note = $state('');
  const picked = new SvelteSet<string>();

  $effect(() => {
    groups = null;
    void versionsOf(projectId, nodeId).then((v) => {
      groups = v ? refChoices(v) : [];
      note = v ? '' : 'Could not read the repository';
    });
  });

  function toggle(ref: string) {
    if (picked.has(ref)) {
      picked.delete(ref);
      return;
    }
    if (picked.size < MAX_PICKED) {
      picked.add(ref);
    }
  }

  async function compare() {
    busy = true;
    note = 'Importing versions…';
    const frames = await compareRefs(projectId, nodeId, [...picked]);
    busy = false;
    if (!frames.length) {
      note = 'The versions could not be imported';
      return;
    }
    oncompared(frames);
  }
</script>

<div class="ref-picker" data-testid="ref-picker" role="dialog" aria-label="Compare versions" style="left:{anchor.left}px;top:{anchor.top}px">
  <header><strong>Compare versions</strong><button type="button" aria-label="Close" onclick={onclose}>×</button></header>
  <div class="list">
    {#if groups === null}
      <p class="muted">Reading refs…</p>
    {/if}
    {#each groups ?? [] as g (g.group)}
      <div class="group">{g.group}</div>
      {#each g.choices as c (c.ref)}
        <label class="choice">
          <input type="checkbox" checked={picked.has(c.ref)} disabled={!picked.has(c.ref) && picked.size >= MAX_PICKED} onchange={() => toggle(c.ref)} data-testid="ref-choice" data-ref={c.ref} />
          <code>{c.label}</code>
          <span class="muted">{c.detail}</span>
        </label>
      {/each}
    {/each}
  </div>
  <footer>
    {#if note}<span class="muted">{note}</span>{/if}
    <button type="button" class="primary" disabled={busy || !picked.size} data-testid="ref-compare" onclick={compare}>Compare {picked.size || ''}</button>
  </footer>
</div>

<style>
  .ref-picker {
    position: absolute;
    width: 320px;
    max-height: 420px;
    display: flex;
    flex-direction: column;
    background: var(--ui-surface);
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-md);
    box-shadow: var(--ui-shadow-lg, 0 8px 24px rgb(0 0 0 / 0.18));
    pointer-events: auto;
    font-size: 12px;
    z-index: 30;
  }
  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
  }
  header {
    border-bottom: 1px solid var(--ui-line);
  }
  footer {
    border-top: 1px solid var(--ui-line);
  }
  header button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .list {
    overflow: auto;
    padding: 4px 0;
  }
  .group {
    padding: 8px 10px 2px;
    font-weight: 600;
    color: var(--ui-muted);
  }
  .choice {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    cursor: pointer;
    border-radius: var(--ui-radius-sm);
  }
  .choice:hover {
    background: var(--ui-wash);
  }
  .choice .muted {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .muted {
    color: var(--ui-muted);
  }
  .primary {
    margin-left: auto;
    border: 0;
    padding: 4px 10px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-accent, #111);
    color: var(--ui-on-accent, #fff);
    cursor: pointer;
  }
  .primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
