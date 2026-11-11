<script lang="ts">
  import CanvasTopBar from '$lib/components/canvas/CanvasTopBar.svelte';
  import FloatingRail from '$lib/components/canvas/FloatingRail.svelte';
  import CanvasAddBar from '$lib/components/canvas/CanvasAddBar.svelte';
  import History from '@lucide/svelte/icons/history';
  import { dotBackground } from '$lib/canvas/dot-grid';
  import { readChatOpen } from '$lib/shell-prefs';
  import { rightBar } from '$lib/components/brand-agent/right-bar-host.svelte';

  const ORIGIN = { x: 0, y: 0, zoom: 1 };
  const SKELETON_PROFILE = { name: null, email: '', avatarUrl: null };

  const chatOpen = readChatOpen(false);
  const dots = Object.entries(dotBackground(ORIGIN))
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');

  const idle = () => undefined;
  const shared = async () => undefined;
</script>

<div class="canvas-entry" aria-busy="true" aria-live="polite" data-testid="canvas-entry-skeleton" inert>
  <div class="entry-stage" style={dots}>
    <CanvasTopBar projectId="" projectName="" projects={[]} canvasHref="" creditBalance={0} {chatOpen} onToggleChat={idle} shareToken={null} onShare={shared} profile={SKELETON_PROFILE} org={null} />
    <FloatingRail onPanel={idle} onSheet={idle} onRoute={idle} />
    <CanvasAddBar onpick={idle} onupload={idle} oncloud={idle} ontemplate={idle} onframes={idle} onfigma={idle} onurl={idle} oncode={idle} oncomment={idle} />
    <span class="entry-runs"><History size={16} /></span>
    {#if chatOpen}
      <div class="entry-chat" style={`--chat-w: ${rightBar.width}px;`}></div>
    {/if}
  </div>
</div>

<style>
  .canvas-entry {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: var(--ui-canvas);
  }

  .entry-stage {
    --chrome-top: 56px;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .entry-stage :global(.switcher-btn),
  .entry-stage :global(.credits) {
    position: relative;
  }

  .entry-stage :global(.switcher-btn) {
    width: 220px;
  }

  .entry-stage :global(.credits) {
    min-width: 101px;
  }

  .entry-stage :global(.switcher-btn > *),
  .entry-stage :global(.credits > *) {
    visibility: hidden;
  }

  .entry-stage :global(.switcher-btn)::after,
  .entry-stage :global(.credits)::after {
    content: '';
    position: absolute;
    inset: 9px 10px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-wash);
    animation: canvas-entry-pulse 1.2s ease-in-out infinite;
  }

  .entry-runs {
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: var(--ui-radius-full);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
    color: var(--ui-icon-ink);
  }

  .entry-chat {
    position: absolute;
    top: 56px;
    right: 12px;
    bottom: 12px;
    z-index: 30;
    width: min(var(--chat-w), calc(100vw - 92px));
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  @keyframes canvas-entry-pulse {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .entry-stage :global(.switcher-btn)::after,
    .entry-stage :global(.credits)::after {
      animation: none;
    }
  }

  @media (max-width: 767px) {
    .entry-stage > :global(*) {
      display: none;
    }
  }
</style>
