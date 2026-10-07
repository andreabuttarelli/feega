<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import { sceneMap } from '$lib/motion/scene-map';

  let { doc, frame, selected = null, onpick }: { doc: MotionDoc; frame: number; selected?: string | null; onpick?: (clipId: string) => void } = $props();

  const DEG = Math.PI / 180;

  const map = $derived(sceneMap(doc, frame));
  const stroke = $derived(map ? map.box.width / 160 : 1);
  const reach = $derived(map ? map.box.height * 1.5 : 0);

  function ray(sign: number): string {
    if (!map) {
      return '';
    }
    const angle = (map.camera.yaw + sign * map.camera.halfFov) * DEG;
    return `${map.camera.x - Math.sin(angle) * reach},${map.camera.depth + Math.cos(angle) * reach}`;
  }
</script>

{#if map}
  <svg class="map" data-testid="scene-map" viewBox={`${map.box.left} ${map.box.top} ${map.box.width} ${map.box.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Scene map seen from above">
    <polygon class="cone" points={`${map.camera.x},${map.camera.depth} ${ray(-1)} ${ray(1)}`} />
    <line class="focus" class:off={!map.dof} x1={map.box.left} x2={map.box.left + map.box.width} y1={map.focus} y2={map.focus} stroke-width={stroke} stroke-dasharray={`${stroke * 4} ${stroke * 3}`} />
    {#each map.layers as layer (layer.id)}
      <line
        class="layer"
        class:dim={!layer.shown}
        class:picked={layer.id === selected}
        role="button"
        tabindex="-1"
        aria-label={`Layer ${layer.id} at depth ${layer.depth}`}
        x1={-layer.half}
        x2={layer.half}
        y1={layer.depth}
        y2={layer.depth}
        stroke-width={stroke * 3}
        onclick={() => onpick?.(layer.id)}
        onkeydown={() => {}}
      />
    {/each}
    <rect class="camera" x={map.camera.x - stroke * 4} y={map.camera.depth - stroke * 4} width={stroke * 8} height={stroke * 8} />
  </svg>
{/if}

<style>
  .map {
    display: block;
    width: 100%;
    height: 150px;
    background: var(--ui-surface);
    border: 1px solid var(--ui-line);
  }

  .cone {
    fill: color-mix(in srgb, var(--ui-accent) 12%, transparent);
  }

  .focus {
    stroke: var(--ui-accent);
  }

  .focus.off {
    opacity: 0.35;
  }

  .layer {
    stroke: var(--ui-ink);
    cursor: pointer;
  }

  .layer.dim {
    opacity: 0.3;
  }

  .layer.picked {
    stroke: var(--ui-accent);
  }

  .camera {
    fill: #e11d48;
  }
</style>
