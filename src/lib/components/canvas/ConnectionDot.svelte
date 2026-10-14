<script lang="ts">
  import { LINK_DOT, type LinkState } from '$lib/realtime/connection-link';

  let { state }: { state: LinkState } = $props();

  const dot = $derived(LINK_DOT[state]);
</script>

<span class="connection-dot" role="status" data-link={state} title={dot.label} aria-label={dot.label} style="--dot: {dot.tone}"></span>

<style>
  .connection-dot {
    display: inline-block;
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dot);
  }

  .connection-dot[data-link='reconnecting'],
  .connection-dot[data-link='connecting'] {
    animation: link-pulse 1.2s ease-in-out infinite;
  }

  @keyframes link-pulse {
    50% { opacity: 0.35; }
  }

  @media (prefers-reduced-motion: reduce) {
    .connection-dot { animation: none; }
  }
</style>
