<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { renderDocHtml } from '$lib/canvas/doc-render';
  import StoryboardMini from './StoryboardMini.svelte';
  import type { OutlinePoint } from '$lib/motion/storyboard';

  const TICK_MS = 1000;

  let { brief, seconds, held = false, board = null, ongo, onedit }: { brief: string; seconds: number; held?: boolean; board?: { href: string; outline: OutlinePoint[] } | null; ongo: () => void; onedit: () => void } = $props();

  let left = $state(0);
  let open = $state(false);
  const html = $derived(renderDocHtml(brief));

  $effect.pre(() => {
    left = seconds;
  });

  $effect(() => {
    if (held) {
      return;
    }
    const timer = setInterval(() => {
      left -= 1;
      if (left > 0) {
        return;
      }
      clearInterval(timer);
      ongo();
    }, TICK_MS);
    return () => clearInterval(timer);
  });
</script>

<section class="brief" data-testid="script-brief" aria-label={$_('chat.panel.brief.title')}>
  <header>
    <strong>{$_('chat.panel.brief.title')}</strong>
    <span class="count" aria-live="polite">{held ? $_('chat.panel.brief.held') : $_('chat.panel.brief.countdown', { values: { seconds: left || seconds } })}</span>
  </header>
  {#if board}
    <StoryboardMini href={board.href} outline={board.outline} />
  {/if}
  <div class="body prose" class:open>{@html html}</div>
  <button type="button" class="more" onclick={() => (open = !open)} aria-expanded={open}>{open ? '−' : '+'}</button>
  <footer>
    <button type="button" class="edit" data-testid="brief-edit" onclick={onedit}>{$_('chat.panel.brief.edit')}</button>
    <button type="button" class="go" data-testid="brief-go" onclick={ongo}>{$_('chat.panel.brief.go')}</button>
  </footer>
</section>

<style>
  .brief {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper-2, #fafafa);
    font-size: 12.5px;
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .count {
    color: var(--ink-faint, #86868b);
    font-size: 12px;
  }
  .body {
    max-height: 240px;
    overflow: hidden;
    line-height: 1.45;
    mask-image: linear-gradient(to bottom, black 70%, transparent);
  }
  .body.open {
    max-height: none;
    mask-image: none;
  }
  .body :global(p),
  .body :global(ul) {
    margin: 0 0 4px;
    padding-left: 14px;
  }
  .more {
    align-self: center;
    border: 0;
    background: none;
    cursor: pointer;
    color: var(--ink-faint, #86868b);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  footer button {
    min-height: 30px;
    padding: 0 12px;
    border: 1px solid var(--ink, #1d1d1f);
    font: inherit;
    cursor: pointer;
  }
  .edit {
    background: transparent;
    color: var(--ink, #1d1d1f);
  }
  .go {
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
  }
</style>
