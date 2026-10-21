<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { CHROME_LOADERS } from '$lib/canvas/chrome-loaders';
  import { guideOpenRequest } from '$lib/canvas/guide-open';
  import { readChatTab, writeChatTab } from '$lib/shell-prefs';
  import CanvasGuideTab from '$lib/components/canvas/CanvasGuideTab.svelte';
  import { anyChatRunning } from './chat-session.svelte';
  import { BarTab, moveKeepingScroll, restoreScroll, rightBar } from './right-bar-host.svelte';

  let { projectId, viewOnly = false }: { projectId: string; viewOnly?: boolean } = $props();

  const LABELS: Record<BarTab, () => string> = {
    [BarTab.Chat]: () => $_('app.shell.chatTab'),
    [BarTab.Guide]: () => $_('app.shell.guideTab'),
    [BarTab.Properties]: () => 'Properties'
  };
  const TEST_IDS: Record<BarTab, string> = {
    [BarTab.Chat]: 'side-tab-chat',
    [BarTab.Guide]: 'bar-tab-guide',
    [BarTab.Properties]: 'side-tab-properties'
  };

  let park = $state<HTMLDivElement | null>(null);
  let bar = $state<HTMLDivElement | null>(null);
  let guideSeen = $state(false);
  const offsets = new Map<Element, number>();

  rightBar.select(readChatTab() as BarTab);

  const tab = $derived(rightBar.tab);
  const binding = $derived(rightBar.active?.binding ?? null);
  const onbusy = $derived.by(() => {
    const current = binding;
    return (busy: boolean) => current?.onbusy?.(busy);
  });

  $effect(() => {
    if (tab === BarTab.Guide) {
      guideSeen = true;
    }
    if (bar) {
      restoreScroll(bar, offsets);
    }
  });

  $effect(() => {
    const target = rightBar.holder?.element ?? park;
    if (!bar || !target) {
      return;
    }
    moveKeepingScroll(bar, target, offsets);
  });

  $effect(() => {
    if ($guideOpenRequest) {
      pick(BarTab.Guide);
    }
  });

  function pick(next: BarTab) {
    rightBar.select(next);
    writeChatTab(next);
  }

  $effect(() => {
    const shown = bar;
    if (!shown) {
      return;
    }
    const back = new ResizeObserver(() => restoreScroll(shown, offsets));
    back.observe(shown);
    return () => back.disconnect();
  });

  function remember(e: Event) {
    const el = e.target as Element;
    if (!el.clientHeight) {
      return;
    }
    offsets.set(el, el.scrollTop);
  }
</script>

<div class="park" bind:this={park}>
  <div class="right-bar" bind:this={bar} data-testid="right-bar" onscrollcapture={remember}>
    <div class="chat-tabs" role="tablist" aria-label={$_('app.shell.rail')}>
      {#each rightBar.tabs as each (each)}
        <button type="button" class="chat-tab" role="tab" aria-selected={tab === each} class:is-active={tab === each} data-testid={TEST_IDS[each]} onclick={() => pick(each)}>
          {LABELS[each]()}{#if each === BarTab.Chat && tab !== BarTab.Chat && anyChatRunning()}<span class="activity" data-testid="chat-activity" aria-label="Agent running"></span>{/if}
        </button>
      {/each}
    </div>
    <div class="pane" hidden={tab !== BarTab.Chat}>
      {#if viewOnly}
        <p class="chat-view-only" data-testid="chat-view-only">View only: the chat edits the canvas and spends credits. Ask an admin for edit access.</p>
      {:else}
        {#await CHROME_LOADERS.chat() then { default: ChatPanel }}
          <ChatPanel {projectId} prefill={rightBar.prefill} reload={rightBar.reload} context={() => binding?.context?.() ?? {}} onturnend={() => binding?.onturnend?.()} ondata={(part) => binding?.ondata?.(part)} {onbusy} />
        {/await}
      {/if}
    </div>
    <div class="pane is-guide" hidden={tab !== BarTab.Guide}>
      {#if guideSeen}
        <CanvasGuideTab initialSlug={$guideOpenRequest} onopened={() => guideOpenRequest.set(null)} />
      {/if}
    </div>
    <div class="pane" hidden={tab !== BarTab.Properties} bind:this={rightBar.propertiesPane}></div>
  </div>
</div>

<style>
  .park {
    position: fixed;
    top: 0;
    left: -200vw;
    width: 400px;
    height: 100dvh;
    visibility: hidden;
    pointer-events: none;
  }

  .right-bar {
    flex: 1;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--grey-0);
    color: var(--ui-ink);
    font-family: var(--sans);
    --ui-ink-2: var(--ui-text-2);
    --ui-ink-3: var(--ui-text-3);
    visibility: visible;
    pointer-events: auto;
  }

  .park > .right-bar {
    visibility: hidden;
    pointer-events: none;
  }

  .chat-tabs {
    flex: 0 0 auto;
    align-self: flex-start;
    display: flex;
    gap: 2px;
    margin: 8px 12px 4px;
    padding: 2px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .chat-tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    font: inherit;
    font-size: var(--ui-type-body);
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text-secondary);
    cursor: pointer;
  }
  .chat-tab:hover {
    color: var(--ui-text);
  }
  .chat-tab.is-active {
    background: var(--ui-panel-raised);
    color: var(--ui-text);
    font-weight: var(--ui-weight-semibold);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.14);
  }
  .chat-tab:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .activity {
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent);
  }

  .pane {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .pane[hidden] {
    display: none;
  }
  .pane > :global(*) {
    flex: 1;
    min-height: 0;
  }
  .pane.is-guide {
    padding: 10px 12px;
    overflow: auto;
  }

  .chat-view-only {
    margin: 0;
    padding: var(--ui-space-4);
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
  }

  @media (max-width: 767px) {
    .chat-tab {
      min-width: 44px;
      font-size: 14px;
    }
  }
</style>
