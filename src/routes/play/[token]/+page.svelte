<script lang="ts">
  import { onMount } from 'svelte';
  import PrototypePlayer from '$lib/components/motion/PrototypePlayer.svelte';

  let { data } = $props();

  let mounted = $state(false);
  const frames = $derived(data.prototype.frames.map((f) => ({ id: f.id, name: f.name, live: { doc: f.doc, tokens: f.tokens, assets: f.assets } })));

  onMount(() => (mounted = true));
</script>

<svelte:head>
  <title>{data.prototype.canvasName}</title>
  <meta name="robots" content="noindex" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

{#if mounted}
  <PrototypePlayer {frames} start={data.prototype.start} />
{/if}
