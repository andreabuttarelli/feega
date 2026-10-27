<script lang="ts">
  import PrototypePlayer, { type PlayerFrame } from '$lib/components/motion/PrototypePlayer.svelte';
  import { prototypePlayer } from '$lib/canvas/prototype-player.svelte';

  let { frames }: { frames: PlayerFrame[] } = $props();

  const start = $derived(prototypePlayer.start);
</script>

{#if start && frames.some((f) => f.id === start)}
  {#key start}
    <PrototypePlayer {frames} {start} onclose={() => prototypePlayer.stop()} />
  {/key}
{/if}
