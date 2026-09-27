<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Share2 from '@lucide/svelte/icons/share-2';
  import { ShareState } from '$lib/canvas/shared-view';

  let {
    shareToken,
    onShare
  }: {
    shareToken: string | null;
    onShare: (state: ShareState) => Promise<void>;
  } = $props();

  let open = $state(false);
  let busy = $state(false);
  let copied = $state(false);
  let root = $state<HTMLElement>();

  const link = $derived(shareToken && typeof location !== 'undefined' ? `${location.origin}/s/${shareToken}` : '');

  async function set(state: ShareState) {
    busy = true;
    copied = false;
    try {
      await onShare(state);
    } finally {
      busy = false;
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    copied = true;
  }

  function closeOutside(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) {
      open = false;
    }
  }
</script>

<svelte:window onclick={closeOutside} />

<div class="share" bind:this={root}>
  <button type="button" class="share-btn" aria-expanded={open} onclick={() => (open = !open)}>
    <Share2 size={14} />
    <span class="share-label">{$_('app.shell.share')}</span>
  </button>

  {#if open}
    <div class="share-pop" role="dialog" aria-label={$_('app.shell.share')}>
      <label class="share-toggle">
        <input
          type="checkbox"
          checked={shareToken !== null}
          disabled={busy}
          onchange={(e) => set(e.currentTarget.checked ? ShareState.On : ShareState.Off)}
        />
        <span>{$_('app.shell.shareAnyone')}</span>
      </label>

      {#if shareToken}
        <div class="share-link">
          <input type="text" readonly value={link || `/s/${shareToken}`} onfocus={(e) => e.currentTarget.select()} />
          <button type="button" onclick={copy}>{$_(copied ? 'app.shell.shareCopied' : 'app.shell.shareCopy')}</button>
        </div>
        <button type="button" class="share-reset" disabled={busy} onclick={() => set(ShareState.On)}>
          {$_('app.shell.shareNewLink')}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .share {
    position: relative;
  }

  .share-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    flex-shrink: 0;
    appearance: none;
    border: 1px solid var(--line, #ededef);
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
    padding: 0 10px;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .share-btn:hover {
    background: var(--ink-soft, #333);
  }

  .share-pop {
    position: absolute;
    top: 40px;
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 300px;
    padding: 12px;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.1);
    font-size: 12px;
  }

  .share-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .share-link {
    display: flex;
    gap: 6px;
  }
  .share-link input {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 6px;
    border: 1px solid var(--line, #ededef);
    font: inherit;
    font-size: 11px;
    color: var(--ink-soft, #6e6e73);
  }
  .share-link button,
  .share-reset {
    height: 28px;
    padding: 0 10px;
    appearance: none;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .share-reset {
    align-self: flex-start;
    color: var(--ink-soft, #6e6e73);
  }

  @media (max-width: 480px) {
    .share-label {
      display: none;
    }
    .share-btn {
      width: 30px;
      padding: 0;
      justify-content: center;
    }
  }
</style>
