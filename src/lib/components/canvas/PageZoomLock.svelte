<script lang="ts">
  import { lockPageZoom, type CanvasZoom } from '$lib/canvas/page-zoom';

  let { zoom = null }: { zoom?: CanvasZoom | null } = $props();

  $effect(() => lockPageZoom(window, zoom));
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
</svelte:head>
