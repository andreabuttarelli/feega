<script lang="ts">
  const ART = [
    '..........................',
    '.....##...................',
    '....####......####........',
    '...######....######.......',
    '..##########.#######......',
    '.#######################..',
    '.########################.',
    '..######################..',
    '...####################...',
    '..........................'
  ];
  const PIXEL = 10;
  const cells = ART.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === '#' ? [{ x, y }] : [])));
  const width = ART[0].length * PIXEL;
  const height = ART.length * PIXEL;
</script>

<svg viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  {#each cells as cell (`${cell.x}-${cell.y}`)}
    <rect x={cell.x * PIXEL} y={cell.y * PIXEL} width={PIXEL} height={PIXEL} opacity={0.35 + ((cell.x * 7 + cell.y * 13) % 6) * 0.13} />
  {/each}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: var(--sx-accent);
  }
</style>
