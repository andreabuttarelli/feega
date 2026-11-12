<script lang="ts">
  import { MARK_LOBE, MARK_TURNS, MarkTone } from './mark';

  let { size = 16, tone = MarkTone.Orange, label }: { size?: number; tone?: MarkTone; label?: string } = $props();
</script>

<svg class="mark" width={size} height={size} viewBox="0 0 300 300" fill={tone} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
  {#each MARK_TURNS as turn (turn)}
    <path d={MARK_LOBE} transform="rotate({turn} 150 150)" />
  {/each}
</svg>

<style>
  .mark {
    display: block;
    flex: none;
  }
</style>
