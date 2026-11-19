<script lang="ts">
  import PrototypePlayer, { type PlayerFrame } from '$lib/components/motion/PrototypePlayer.svelte';
  import LivePagePlayer from './LivePagePlayer.svelte';
  import { prototypePlayer } from '$lib/canvas/prototype-player.svelte';
  import { PlayKind, playKindOf, type LivePage } from '$lib/canvas/play-target';

  let { frames, pages = [], origin = null }: { frames: PlayerFrame[]; pages?: LivePage[]; origin?: string | null } = $props();

  const start = $derived(prototypePlayer.start);
  const kind = $derived(start ? playKindOf(start, new Set(frames.map((f) => f.id)), new Set(pages.map((p) => p.id))) : null);
  const page = $derived(pages.find((p) => p.id === start));
  const stop = () => prototypePlayer.stop();
</script>

{#key start}
  {#if kind === PlayKind.Drawn && start}
    <PrototypePlayer {frames} {start} onclose={stop} />
  {:else if kind === PlayKind.Live && page}
    <LivePagePlayer {page} {origin} onclose={stop} />
  {/if}
{/key}
