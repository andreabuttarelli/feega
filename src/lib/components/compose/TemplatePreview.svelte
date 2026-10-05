<script lang="ts">
  import type { LayoutId } from '$lib/canvas/composition/types';
  import CompositionPlayer from '$lib/components/motion/CompositionPlayer.svelte';
  import { applyDraft, newDraft } from '$lib/motion/composition-draft';
  import { newMotionDoc, type MotionDoc } from '$lib/motion/doc';

  let { layout, pictures }: { layout: LayoutId; pictures: string[] } = $props();

  const TILE_SIDE = 256;
  const TILE_COUNT = 6;
  const TILE_HUES = [18, 42, 200, 160, 280, 340];
  const SAMPLE = 'sample';

  let host = $state<HTMLDivElement | null>(null);
  let visible = $state(false);
  let urls = $state<string[]>([]);

  function tiles(): string[] {
    return Array.from({ length: TILE_COUNT }, (_, i) => {
      const tile = document.createElement('canvas');
      tile.width = TILE_SIDE;
      tile.height = TILE_SIDE;
      const ctx = tile.getContext('2d');
      if (!ctx) {
        return '';
      }
      const hue = TILE_HUES[i % TILE_HUES.length];
      const fill = ctx.createLinearGradient(0, 0, TILE_SIDE, TILE_SIDE);
      fill.addColorStop(0, `hsl(${hue} 55% 62%)`);
      fill.addColorStop(1, `hsl(${hue + 30} 50% 28%)`);
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, TILE_SIDE, TILE_SIDE);
      return tile.toDataURL('image/png');
    });
  }

  $effect(() => {
    if (!host) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    observer.observe(host);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (visible && !urls.length) {
      urls = pictures.length ? pictures : tiles();
    }
  });

  const assets = $derived(Object.fromEntries(urls.map((url, i) => [`${SAMPLE}${i}`, url])));

  const doc = $derived.by((): MotionDoc | null => {
    const draft = newDraft(layout);
    const verdict = applyDraft(newMotionDoc(draft.format), { ...draft, media: urls.map((_, i) => ({ assetId: `${SAMPLE}${i}`, kind: 'image' as const })) });
    return verdict.ok ? verdict.doc : null;
  });
</script>

<div bind:this={host} class="template-preview" aria-hidden="true">
  {#if visible && doc && urls.length}
    <CompositionPlayer {doc} {assets} active={visible} />
  {/if}
</div>

<style>
  .template-preview {
    display: block;
    width: 100%;
    height: 100%;
    background: #000;
  }
</style>
