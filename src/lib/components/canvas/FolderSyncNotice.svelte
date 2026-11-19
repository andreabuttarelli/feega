<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import { Keep as Side, type Conflict } from '@feega/canvas-folder';
  import GitMerge from '@lucide/svelte/icons/git-merge';
  import Laptop from '@lucide/svelte/icons/laptop';
  import FolderGit from '@lucide/svelte/icons/folder-git';
  import Check from '@lucide/svelte/icons/check';
  import Undo from '@lucide/svelte/icons/undo-2';
  import X from '@lucide/svelte/icons/x';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import TypeIcon from '@lucide/svelte/icons/type';
  import ImageIcon from '@lucide/svelte/icons/image';
  import VideoIcon from '@lucide/svelte/icons/video';
  import FrameIcon from '@lucide/svelte/icons/frame';
  import NoteIcon from '@lucide/svelte/icons/sticky-note';
  import SquareIcon from '@lucide/svelte/icons/square';
  import { changedAtLine, fieldLabel, shownValue, unsavedLine, valueKind, ValueKind } from '$lib/canvas/folder-sync';

  type Status = { relation: string; notice: string | null; conflicts: Conflict[]; unsavedSince: string | null; failedAssets: string[]; openedAt: string };
  type NodeInfo = { name: string | null; type: string };

  let { nodes }: { nodes: Record<string, NodeInfo> } = $props();

  const ENDPOINT = '/local/folder';
  const POLL_MS = 5000;
  const SHORT_ID = 8;

  const NODE_ICONS: Record<string, Component> = { text: TypeIcon, image: ImageIcon, video: VideoIcon, frame: FrameIcon, doc: NoteIcon };

  const SIDES = [
    { side: Side.Mine, label: 'Mine', icon: Laptop, value: (c: Conflict) => c.ours },
    { side: Side.Theirs, label: 'Theirs', icon: FolderGit, value: (c: Conflict) => c.theirs }
  ];

  let status = $state<Status | null>(null);
  let dismissed = $state(false);
  let busy = $state(false);
  const chosen = new SvelteMap<string, Side>();
  const collapsed = new SvelteSet<string>();
  const COLLAPSE_MS = 450;

  function choose(conflict: Conflict, side: Side) {
    const key = keyOf(conflict);
    chosen.set(key, side);
    setTimeout(() => chosen.get(key) === side && collapsed.add(key), COLLAPSE_MS);
  }

  function undo(conflict: Conflict) {
    chosen.delete(keyOf(conflict));
    collapsed.delete(keyOf(conflict));
  }

  const keyOf = (c: Conflict) => `${c.collection}/${c.id}/${c.field}`;
  const conflicts = $derived(status?.conflicts ?? []);
  const resolvedCount = $derived(conflicts.filter((c) => chosen.has(keyOf(c))).length);
  const open = $derived(status !== null && !dismissed && (conflicts.length > 0 || Boolean(status.unsavedSince) || status.failedAssets.length > 0 || Boolean(status.notice)));

  const nodeName = (c: Conflict) => nodes[c.id]?.name ?? (c.collection === 'nodes' ? c.id.slice(0, SHORT_ID) : c.collection);
  const nodeIcon = (c: Conflict) => NODE_ICONS[nodes[c.id]?.type ?? ''] ?? SquareIcon;

  async function load() {
    const response = await fetch(ENDPOINT).catch(() => null);
    status = response?.ok ? await response.json() : null;
  }

  function chooseAll(side: Side) {
    conflicts.forEach((c) => {
      chosen.set(keyOf(c), side);
      collapsed.add(keyOf(c));
    });
  }

  async function apply() {
    busy = true;
    const picked = conflicts.filter((c) => chosen.has(keyOf(c)));
    for (const conflict of picked) {
      await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conflict, keep: chosen.get(keyOf(conflict)) }) });
    }
    busy = false;
    if (picked.some((c) => chosen.get(keyOf(c)) === Side.Theirs)) {
      location.reload();
      return;
    }
    chosen.clear();
    collapsed.clear();
    await load();
  }

  onMount(() => {
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  });
</script>

{#snippet value(raw: unknown)}
  {@const kind = valueKind(raw)}
  {#if kind === ValueKind.Color}
    <span class="value"><span class="swatch rounded-xs" style:background={String(raw)}></span><code>{String(raw)}</code></span>
  {:else if kind === ValueKind.Image}
    <span class="value"><img class="thumb rounded-xs" src={String(raw)} alt="" /></span>
  {:else if kind === ValueKind.Removed}
    <span class="value removed">Removed</span>
  {:else}
    <code class="value">{typeof raw === 'string' ? raw : shownValue(raw)}</code>
  {/if}
{/snippet}

{#if status && open}
  <section class="folder-sync rounded-lg" role="status" data-testid="folder-sync">
    <header>
      <span class="badge rounded-md"><GitMerge size={16} /></span>
      <div class="heading">
        <h3>{conflicts.length ? 'Merged outside changes' : (status.notice ?? 'Project folder')}</h3>
        <p>{status.unsavedSince ? unsavedLine(status.unsavedSince) : changedAtLine(status.openedAt)}</p>
      </div>
      {#if conflicts.length}
        <span class="pill rounded-full"><TriangleAlert size={12} />{conflicts.length} {conflicts.length === 1 ? 'conflict' : 'conflicts'}</span>
      {/if}
      <button type="button" class="icon-button rounded-sm" aria-label="Dismiss" onclick={() => (dismissed = true)}><X size={14} /></button>
    </header>

    {#if status.failedAssets.length}
      <details class="failed rounded-md">
        <summary>{status.failedAssets.length} media could not be saved into .feega/assets</summary>
        <ul>
          {#each status.failedAssets as url (url)}
            <li><code>{url}</code></li>
          {/each}
        </ul>
      </details>
    {/if}

    {#if conflicts.length}
      <ul class="cards" data-testid="folder-conflicts">
        {#each conflicts as conflict (keyOf(conflict))}
          {@const Icon = nodeIcon(conflict)}
          {@const pick = chosen.get(keyOf(conflict))}
          {#if pick && collapsed.has(keyOf(conflict))}
            <li class="resolved rounded-md" data-testid="folder-resolved">
              <Check size={14} class="ok" />
              <span class="name">{nodeName(conflict)}</span>
              <span class="chip rounded-sm">{fieldLabel(conflict.field)}</span>
              <span class="kept">Keeping {pick === Side.Mine ? 'mine' : 'theirs'}</span>
              <button type="button" class="undo rounded-sm" onclick={() => undo(conflict)}><Undo size={12} />Undo</button>
            </li>
          {:else}
            <li class="card rounded-md">
              <div class="card-head">
                <Icon size={14} />
                <span class="name">{nodeName(conflict)}</span>
                <span class="chip rounded-sm">{fieldLabel(conflict.field)}</span>
              </div>
              <div class="tiles">
                {#each SIDES as option (option.side)}
                  {@const SideIcon = option.icon}
                  <button type="button" class="tile {option.side} rounded-sm" aria-pressed={pick === option.side} disabled={busy} onclick={() => choose(conflict, option.side)}>
                    <span class="tile-label"><SideIcon size={12} />{option.label}</span>
                    {#if pick === option.side}
                      <span class="tick rounded-full"><Check size={10} /></span>
                    {/if}
                    {@render value(option.value(conflict))}
                  </button>
                {/each}
              </div>
            </li>
          {/if}
        {/each}
      </ul>

      <footer>
        <span class="count">{resolvedCount} of {conflicts.length} resolved</span>
        {#if conflicts.length > 1}
          <button type="button" class="secondary rounded-sm" disabled={busy} onclick={() => chooseAll(Side.Mine)}>Keep all mine</button>
          <button type="button" class="secondary rounded-sm" disabled={busy} onclick={() => chooseAll(Side.Theirs)}>Keep all theirs</button>
        {/if}
        <button type="button" class="primary rounded-sm" disabled={busy || resolvedCount === 0} onclick={apply}>Apply</button>
      </footer>
    {/if}
  </section>
{/if}

<style>
  .folder-sync {
    position: absolute;
    z-index: 10;
    right: 16px;
    top: calc(var(--chrome-top, 10px) + 52px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(400px, calc(100% - 32px));
    max-height: 70vh;
    overflow-y: auto;
    padding: 12px;
    font-size: var(--ui-text-sm);
    color: var(--ui-text);
    background: var(--ui-panel-raised);
    border: 1px solid var(--ui-line);
    box-shadow: var(--ui-shadow-float);
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .badge {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex: none;
    color: var(--ui-accent-text);
    background: var(--ui-accent-wash);
  }

  .heading {
    flex: 1;
    min-width: 0;
  }

  h3 {
    margin: 0;
    font-size: var(--ui-text-md);
    font-weight: var(--ui-weight-semibold);
  }

  .heading p {
    margin: 2px 0 0;
    font-size: var(--ui-text-xs);
    color: var(--ui-text-secondary);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: var(--ui-text-xs);
    font-weight: var(--ui-weight-medium);
    white-space: nowrap;
    color: var(--ui-warn);
    background: color-mix(in srgb, var(--ui-warn) 14%, transparent);
  }

  .icon-button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    color: var(--ui-text-secondary);
    background: none;
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--ui-hover);
  }

  .failed {
    padding: 8px 10px;
    background: var(--ui-panel-sunken);
    color: var(--ui-text-secondary);
  }

  .failed summary {
    cursor: pointer;
  }

  .failed ul {
    margin: 6px 0 0;
    padding-left: 14px;
    word-break: break-all;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card {
    padding: 12px;
    background: var(--ui-panel-sunken);
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    color: var(--ui-text-secondary);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip {
    padding: 1px 6px;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-secondary);
    background: var(--ui-wash);
    border: 1px solid var(--ui-line);
  }

  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  @media (max-width: 420px) {
    .tiles {
      grid-template-columns: 1fr;
    }
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 8px 10px;
    font: inherit;
    text-align: left;
    color: var(--ui-text);
    border: 1px solid transparent;
    cursor: pointer;
    transition: box-shadow var(--ui-dur-fast) var(--ui-ease), border-color var(--ui-dur-fast) var(--ui-ease);
  }

  .tile.mine {
    background: var(--ui-accent-wash);
  }

  .tile.theirs {
    background: var(--ui-wash);
  }

  .tile:hover {
    border-color: var(--ui-line-strong);
  }

  .tile[aria-pressed='true'] {
    box-shadow: 0 0 0 2px var(--ui-ring);
  }

  .tile:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--ui-focus);
  }

  .tick {
    position: absolute;
    top: 6px;
    right: 6px;
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    color: var(--ui-on-accent);
    background: var(--ui-accent-solid);
  }

  .tile-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--ui-text-xs);
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text-secondary);
  }

  .tile.mine .tile-label {
    color: var(--ui-accent-text);
  }

  .value {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    overflow-wrap: anywhere;
  }

  .removed {
    font-family: inherit;
    font-style: italic;
    color: var(--ui-text-tertiary);
  }

  .swatch {
    width: 16px;
    height: 16px;
    flex: none;
    border: 1px solid var(--ui-line);
  }

  .thumb {
    width: 100%;
    max-height: 72px;
    object-fit: cover;
    border: 1px solid var(--ui-line);
  }

  .resolved {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--ui-panel-sunken);
    color: var(--ui-text-secondary);
  }

  .resolved :global(.ok) {
    flex: none;
    color: var(--ui-ok);
  }

  .kept {
    margin-left: auto;
    font-size: var(--ui-text-xs);
    white-space: nowrap;
  }

  .undo {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    font: inherit;
    font-size: var(--ui-text-xs);
    color: var(--ui-text);
    background: none;
    border: 0;
    cursor: pointer;
  }

  .undo:hover {
    background: var(--ui-hover);
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .count {
    margin-right: auto;
    font-size: var(--ui-text-xs);
    color: var(--ui-text-secondary);
  }

  footer button {
    height: var(--ui-control-h);
    padding: 0 10px;
    font: inherit;
    cursor: pointer;
  }

  .secondary {
    color: var(--ui-text);
    background: var(--ui-panel);
    border: 1px solid var(--ui-line);
  }

  .secondary:hover {
    background: var(--ui-hover);
  }

  .primary {
    color: var(--ui-on-accent);
    background: var(--ui-accent-solid);
    border: 0;
  }

  footer button:disabled,
  .tile:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
