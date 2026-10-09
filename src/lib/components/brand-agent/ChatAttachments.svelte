<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { AttachmentKind, extOf, formatBytes } from '$lib/chat-attachments';
  import { UploadStatus, type Upload } from './chat-uploads.svelte';

  let { items, onremove }: { items: Upload[]; onremove?: (id: string) => void } = $props();
</script>

<ul class="chips" aria-label={$_('chat.panel.attach.list')}>
  {#each items as item (item.id)}
    <li class="chip" class:failed={item.status === UploadStatus.Failed}>
      {#if item.preview && item.kind === AttachmentKind.Image}
        <img class="thumb" src={item.preview} alt="" />
      {:else}
        <span class="thumb file" aria-hidden="true">{extOf(item.name) || '?'}</span>
      {/if}
      <span class="meta">
        <span class="name" title={item.name}>{item.name}</span>
        {#if item.status === UploadStatus.Failed}
          <span class="why" role="alert">{item.detail || $_(`chat.panel.attach.error.${item.error ?? 'upload_failed'}`)}</span>
        {:else}
          <span class="size">{formatBytes(item.bytes)}</span>
        {/if}
      </span>
      {#if item.status === UploadStatus.Uploading}
        <span class="bar" role="progressbar" aria-label={$_('chat.panel.attach.uploading', { values: { name: item.name } })} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(item.progress * 100)}>
          <span style={`width: ${Math.round(item.progress * 100)}%`}></span>
        </span>
      {/if}
      {#if onremove}
        <button type="button" class="remove" aria-label={$_('chat.panel.attach.remove', { values: { name: item.name } })} onclick={() => onremove?.(item.id)}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" /></svg>
        </button>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .chip {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 240px;
    padding: 4px;
    background: var(--paper-2, #f5f5f7);
    border: 1px solid var(--line-2, #d2d2d7);
    overflow: hidden;
  }
  .chip.failed {
    border-color: var(--danger, #d93025);
  }
  .thumb {
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
    object-fit: cover;
    background: var(--paper-3, #eee);
  }
  .file {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--ink-soft, #6e6e73);
  }
  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }
  .name {
    font-size: 12.5px;
    color: var(--ink, #1d1d1f);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .size {
    font-size: 11px;
    color: var(--ink-faint, #86868b);
  }
  .why {
    font-size: 11px;
    color: var(--danger, #d93025);
    white-space: normal;
  }
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: transparent;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent, #c485fe);
    transition: width 0.2s ease;
  }
  .remove {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 9999px;
    background: none;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .remove:hover {
    background: var(--paper-3, #eee);
    color: var(--ink, #1d1d1f);
  }
  .remove:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 1px;
  }
  @media (hover: none) {
    .remove {
      width: 44px;
      height: 44px;
    }
  }
</style>
