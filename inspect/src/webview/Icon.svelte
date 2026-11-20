<script lang="ts">
  let { svg, size = 14 }: { svg: string; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="0.833" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html svg}</svg>
