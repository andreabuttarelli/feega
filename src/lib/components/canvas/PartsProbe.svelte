<script lang="ts">
  import MotionPreview from '$lib/components/motion/MotionPreview.svelte';
  import type { MeasuredBox } from '$lib/motion/hyperframes/measure';
  import type { MotionPreview as Preview } from '$lib/canvas/motion-preview';

  const TRIES = 20;
  const PAUSE_MS = 250;
  const DRAWN_WAIT_MS = 1500;

  let { url, onmeasured }: { url: string; onmeasured: (boxes: Record<string, MeasuredBox>) => void } = $props();

  let preview = $state<Preview | null>(null);
  let player = $state<ReturnType<typeof MotionPreview> | null>(null);
  let redraws = $state(0);
  let overdue = $state(false);

  $effect(() => {
    let stale = false;
    void fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<Preview>) : null))
      .then((next) => {
        if (stale) {
          return;
        }
        if (!next) {
          onmeasured({});
          return;
        }
        preview = next;
      })
      .catch(() => !stale && onmeasured({}));
    return () => {
      stale = true;
    };
  });

  $effect(() => {
    if (!player) {
      return;
    }
    const timer = setTimeout(() => (overdue = true), DRAWN_WAIT_MS);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    const shooter = player;
    if (!shooter || (!redraws && !overdue)) {
      return;
    }
    let stale = false;
    void (async () => {
      for (let i = 0; i < TRIES && !stale; i++) {
        const boxes = await shooter.measure();
        if (Object.keys(boxes).length) {
          return !stale && onmeasured(boxes);
        }
        await new Promise((done) => setTimeout(done, PAUSE_MS));
      }
      if (!stale) {
        onmeasured({});
      }
    })();
    return () => {
      stale = true;
    };
  });
</script>

{#if preview}
  <div class="probe" aria-hidden="true" style={`width: ${preview.width}px; height: ${preview.height}px`}>
    <MotionPreview bind:this={player} bind:redraws html={preview.html} width={preview.width} height={preview.height} fps={preview.fps} muted />
  </div>
{/if}

<style>
  .probe {
    position: fixed;
    left: -100000px;
    top: 0;
    pointer-events: none;
    visibility: hidden;
  }
</style>
