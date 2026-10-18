<script lang="ts">
  import { useStore, ViewportPortal } from '@xyflow/svelte';
  import type { CanvasPeer } from '$lib/realtime/canvas-presence';
  import PeerLayer from './PeerLayer.svelte';

  type Rect = { x: number; y: number; w: number; h: number };

  let { peers, rectOf }: { peers: CanvasPeer[]; rectOf: (id: string) => Rect | null } = $props();

  const store = useStore();
</script>

<ViewportPortal target="front">
  <PeerLayer {peers} {rectOf} zoom={store.viewport.zoom} />
</ViewportPortal>
