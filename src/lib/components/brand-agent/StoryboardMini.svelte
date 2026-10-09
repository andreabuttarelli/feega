<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { miniPoints, type OutlinePoint } from '$lib/motion/storyboard';

  const BOX = { w: 240, h: 64, pad: 6 };
  const DOT = 3;

  let { href, outline }: { href: string; outline: OutlinePoint[] } = $props();

  const points = $derived(miniPoints(outline, BOX));
  const curve = $derived(points.filter((p) => !p.branch).map((p) => `${p.x},${p.y}`).join(' '));
</script>

<a class="mini" data-testid="storyboard-mini" {href} aria-label={$_('chat.panel.brief.storyboard')}>
  <svg viewBox="0 0 {BOX.w} {BOX.h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={curve} />
    {#each points as p, i (i)}
      <circle cx={p.x} cy={p.y} r={DOT} class:branch={p.branch} />
    {/each}
  </svg>
  <span>{$_('chat.panel.brief.storyboard')} →</span>
</a>

<style>
  .mini {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    text-decoration: none;
  }
  svg {
    width: 100%;
    height: 64px;
  }
  polyline {
    fill: none;
    stroke: var(--ink, #1d1d1f);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  circle {
    fill: var(--ink, #1d1d1f);
  }
  circle.branch {
    fill: var(--paper, #fff);
    stroke: var(--ink-faint, #86868b);
    vector-effect: non-scaling-stroke;
  }
  span {
    font-size: 12px;
  }
</style>
