<script lang="ts" module>
  const LOBE = 'M61.87 142.25A57 57 0 1 1 136.13 142.25A69.5 69.5 0 0 0 61.87 142.25Z';
  const ROTATIONS = [0, 90, 180, 270];
</script>

<script lang="ts">
  import { MarkTone } from './mark-tone';

  let { size = 16, tone = MarkTone.Brand }: { size?: number; tone?: MarkTone } = $props();
</script>

<svg
  class="feega-mark"
  class:current={tone === MarkTone.Current}
  width={size}
  height={size}
  viewBox="0 0 300 300"
  aria-hidden="true"
  focusable="false"
>
  {#each ROTATIONS as angle (angle)}
    <path d={LOBE} transform="rotate({angle} 150 150)" />
  {/each}
</svg>

<style>
  .feega-mark {
    flex: none;
    fill: var(--brand-orange);
  }

  .feega-mark.current {
    fill: currentColor;
  }
</style>
