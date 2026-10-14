<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Workflow from '@lucide/svelte/icons/workflow';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import { MOBILE_ICON } from '$lib/canvas/mobile-chrome';
  import type { ChatBadge, MobileView } from '$lib/canvas/mobile-view';

  let {
    view,
    badge,
    onselect
  }: { view: MobileView; badge: ChatBadge; onselect: (view: MobileView) => void } = $props();
</script>

<div class="view-switch" role="group" aria-label={$_('app.shell.mobile.switchView')} data-testid="mobile-view-switch">
  <button
    type="button"
    class="segment"
    aria-pressed={view === 'canvas'}
    aria-label={$_('app.shell.mobile.canvas')}
    data-testid="mobile-view-canvas"
    onclick={() => onselect('canvas')}
  >
    <Workflow size={MOBILE_ICON.size} strokeWidth={MOBILE_ICON.stroke} />
  </button>
  <button
    type="button"
    class="segment"
    aria-pressed={view === 'chat'}
    aria-label={$_('app.shell.mobile.chat')}
    data-testid="mobile-view-chat"
    data-badge={badge}
    onclick={() => onselect('chat')}
  >
    <MessageCircle size={MOBILE_ICON.size} strokeWidth={MOBILE_ICON.stroke} />
    <span class="badge" aria-hidden="true"></span>
  </button>
</div>

<style>
  .view-switch {
    position: absolute;
    z-index: 12;
    right: var(--mobile-bar-inset);
    bottom: var(--mobile-switch-bottom, calc(var(--mobile-bar-inset) + env(safe-area-inset-bottom, 0px)));
    display: flex;
    gap: 2px;
    padding: var(--mobile-bar-pad);
    border-radius: var(--ui-radius-full);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
    transition: bottom var(--chrome-move) var(--ease-expo);
  }

  .segment {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--touch-target);
    height: var(--touch-target);
    appearance: none;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: transparent;
    color: var(--ui-icon-ink);
    -webkit-tap-highlight-color: transparent;
  }
  .segment[aria-pressed='true'] {
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
  }
  .segment:active {
    background: var(--ui-pressed);
  }
  .segment[aria-pressed='true']:active {
    background: var(--ui-accent-solid);
  }
  .segment:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 7px;
    height: 7px;
    display: none;
  }
  .segment[data-badge='unread'] .badge {
    display: block;
    background: var(--accent, #7c5cff);
  }
  .segment[data-badge='running'] .badge {
    display: block;
    border: 1.5px solid var(--accent, #7c5cff);
    border-right-color: transparent;
    width: 9px;
    height: 9px;
    animation: badge-spin 800ms linear infinite;
  }
  @keyframes badge-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .segment[data-badge='running'] .badge {
      animation: none;
    }
  }
</style>
