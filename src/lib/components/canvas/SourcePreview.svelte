<script lang="ts">
  import type { Component } from 'svelte';
  import Layers from '@lucide/svelte/icons/layers';
  import Play from '@lucide/svelte/icons/play';
  import type { SyncStatus } from '$lib/canvas/sync-state';

  export type PreviewTile = {
    key: string;
    thumb: string | null;
    label: string;
    caption: string | null;
    badge: 'carousel' | 'video' | null;
  };

  let {
    icon: Icon,
    title,
    tiles,
    total,
    syncStatus,
    syncError,
    empty
  }: {
    icon: Component<{ size?: number; strokeWidth?: number }>;
    title: string;
    tiles: PreviewTile[];
    total: number;
    syncStatus: SyncStatus;
    syncError: string | null;
    empty: string;
  } = $props();

  const BADGES = { carousel: { icon: Layers, label: 'Carosello' }, video: { icon: Play, label: 'Video' } } as const;
</script>

<div class="preview">
  <header class="preview-head">
    <Icon size={13} strokeWidth={1.8} />
    <span class="preview-title">{title}</span>
    <span class="preview-count" class:is-running={syncStatus === 'running'}>
      {syncStatus === 'running' ? 'syncing…' : total ? `${tiles.length}/${total}` : ''}
    </span>
  </header>

  {#if syncStatus === 'failed' && syncError}
    <div class="preview-fail" role="alert">
      <p class="preview-fail-title">Sync failed</p>
      <p class="preview-fail-why">{syncError}</p>
    </div>
  {:else if !tiles.length}
    <p class="preview-empty">{total ? 'No results with these filters.' : empty}</p>
  {:else}
    <ul class="preview-grid">
      {#each tiles as tile (tile.key)}
        <li class="preview-tile" title={tile.caption ?? tile.label}>
          {#if tile.thumb}
            <img class="preview-img" src={tile.thumb} alt={tile.label} loading="lazy" decoding="async" />
          {:else}
            <div class="preview-img preview-img-empty"><Icon size={16} strokeWidth={1.5} /></div>
          {/if}
          {#if tile.badge}
            {@const Badge = BADGES[tile.badge].icon}
            <span class="preview-badge" aria-label={BADGES[tile.badge].label}><Badge size={11} strokeWidth={2} /></span>
          {/if}
          {#if tile.caption}
            <span class="preview-caption">{tile.caption}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e5e5e5);
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.05),
      0 8px 24px -12px rgb(0 0 0 / 0.2);
    overflow: hidden;
  }

  .preview-head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 9px;
    font-size: 11.5px;
    color: var(--ink, #1d1d1f);
    border-bottom: 1px solid var(--line, #e5e5e5);
  }
  .preview-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .preview-count {
    font-size: 10.5px;
    color: var(--ink-soft, #6e6e73);
  }

  .preview-grid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: min-content;
    gap: 4px;
    margin: 0;
    padding: 6px;
    list-style: none;
    overflow-y: auto;
  }

  .preview-tile {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    background: var(--paper-2, #f9f9f9);
  }
  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .preview-img-empty {
    display: grid;
    place-content: center;
    color: var(--ink-soft, #6e6e73);
  }
  .preview-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    display: inline-flex;
    padding: 2px;
    color: #fff;
    background: rgb(0 0 0 / 0.55);
  }
  .preview-caption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 2px 4px;
    font-size: 10px;
    color: #fff;
    background: rgb(0 0 0 / 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preview-empty {
    flex: 1;
    display: grid;
    place-content: center;
    margin: 0;
    padding: 0 16px;
    font-size: 12px;
    text-align: center;
    color: var(--ink-soft, #6e6e73);
  }

  .preview-fail {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 16px;
    text-align: center;
  }
  .preview-fail-title {
    margin: 0;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink, #1d1d1f);
  }
  .preview-fail-why {
    margin: 0;
    font-size: 11px;
    color: var(--ink-soft, #6e6e73);
    word-break: break-word;
  }
</style>
