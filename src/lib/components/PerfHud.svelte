<script lang="ts">
  import { onMount } from 'svelte';
  import { frameStats, HISTOGRAM_EDGES_MS, type FrameStats } from '$lib/perf/frame-stats';

  const WINDOW_FRAMES = 240;
  const REFRESH_MS = 500;
  const LONG_FRAME_MS = 50;
  const FLOW_NODE = '.svelte-flow__node';
  const LONG_TASK = 'longtask';

  let stats = $state<FrameStats>(frameStats([]));
  let longTasks = $state(0);
  let longSource = $state(LONG_TASK);
  let domNodes = $state(0);
  let flowNodes = $state(0);

  const labels = [...HISTOGRAM_EDGES_MS.map((edge) => `<${edge}`), `≥${HISTOGRAM_EDGES_MS.at(-1)}`];
  const peak = $derived(Math.max(1, ...stats.histogram));

  onMount(() => {
    const gaps: number[] = [];
    let last = 0;
    let frame = 0;
    const observesLongTasks = PerformanceObserver.supportedEntryTypes?.includes(LONG_TASK) ?? false;
    longSource = observesLongTasks ? LONG_TASK : `frame>${LONG_FRAME_MS}ms`;

    const tick = (now: number) => {
      if (last) {
        const gap = now - last;
        gaps.push(gap);
        if (!observesLongTasks && gap > LONG_FRAME_MS) {
          longTasks += 1;
        }
      }
      if (gaps.length > WINDOW_FRAMES) {
        gaps.shift();
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const observer = observesLongTasks ? new PerformanceObserver((list) => (longTasks += list.getEntries().length)) : null;
    observer?.observe({ type: LONG_TASK });

    const refresh = setInterval(() => {
      stats = frameStats(gaps);
      domNodes = document.getElementsByTagName('*').length;
      flowNodes = document.querySelectorAll(FLOW_NODE).length;
    }, REFRESH_MS);

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(refresh);
      observer?.disconnect();
    };
  });
</script>

<aside class="hud" data-testid="perf-hud" aria-label="Performance">
  <p class="rate"><strong data-testid="perf-hud-rate">{stats.rate}</strong> fps · worst 5% {stats.worst5Fps}</p>
  <p>frame p50 {stats.p50} · p95 {stats.p95} · max {stats.max} ms</p>
  <div class="bars" role="img" aria-label="Frame time histogram">
    {#each stats.histogram as count, i (i)}
      <span class="bar" style:height="{(count / peak) * 100}%" title="{labels[i]} ms: {count}"></span>
    {/each}
  </div>
  <p class="axis"><span>{labels[0]}</span><span>{labels.at(-1)} ms</span></p>
  <p>long tasks <span data-testid="perf-hud-long">{longTasks}</span> ({longSource})</p>
  <p>DOM <span data-testid="perf-hud-dom">{domNodes}</span> · canvas nodes {flowNodes}</p>
</aside>

<style>
  .hud {
    position: fixed;
    right: 8px;
    bottom: 8px;
    z-index: 2147483647;
    width: 220px;
    padding: 8px;
    font: 11px/1.4 ui-monospace, monospace;
    color: #fff;
    background: rgb(0 0 0 / 0.78);
    pointer-events: none;
  }
  .hud p {
    margin: 0;
  }
  .rate strong {
    font-size: 18px;
  }
  .bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 36px;
    margin-top: 4px;
  }
  .bar {
    flex: 1;
    background: #7c5cff;
  }
  .axis {
    display: flex;
    justify-content: space-between;
    opacity: 0.6;
  }
</style>
