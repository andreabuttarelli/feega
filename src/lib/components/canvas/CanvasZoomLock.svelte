<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { ZoomStep, type CanvasZoom } from '$lib/canvas/page-zoom';
  import { Region, keyRegion } from '$lib/canvas/key-region.svelte';
  import PageZoomLock from './PageZoomLock.svelte';

  const { zoomIn, zoomOut, fitView, getZoom, setZoom } = useSvelteFlow();

  const RUN: Record<ZoomStep, () => void> = {
    [ZoomStep.In]: () => void zoomIn(),
    [ZoomStep.Out]: () => void zoomOut(),
    [ZoomStep.Fit]: () => void fitView()
  };

  const zoom: CanvasZoom = {
    step: (step) => {
      if (keyRegion.current === Region.Canvas) {
        RUN[step]();
      }
    },
    scaleBy: (factor) => void setZoom(getZoom() * factor)
  };
</script>

<PageZoomLock {zoom} />
