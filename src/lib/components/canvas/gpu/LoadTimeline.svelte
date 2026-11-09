<script lang="ts">
  import { imagesNoted } from '$lib/canvas/core/frame-timeline';
  import { loadReport, type LoadReport } from '$lib/canvas/core/load-report';

  const RESOURCE_ENTRIES = 5000;
  performance.setResourceTimingBufferSize?.(RESOURCE_ENTRIES);
  const REFRESH_MS = 1000;
  const REFRESHES = 90;
  const KB = 1024;
  const COLUMNS = ['thumb', 'asked', 'source', 'built', 'images', 'vectors', 'whole', 'put', 'pictured', 'drawn'] as const;

  let report = $state<LoadReport | null>(null);
  let copied = $state(false);

  function read(): LoadReport {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return loadReport({
      marks: performance.getEntriesByType('mark'),
      resources: performance.getEntriesByType('resource') as PerformanceResourceTiming[],
      images: imagesNoted(),
      navigation: navigation ?? null
    });
  }

  $effect(() => {
    report = read();
    let left = REFRESHES;
    const timer = setInterval(() => {
      report = read();
      left--;
      if (left <= 0) {
        clearInterval(timer);
      }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  });

  const end = $derived(Math.max(1, ...(report?.frames ?? []).flatMap((f) => [f.content ?? 0, ...Object.values(f.steps)]), report?.totals.sharp ?? 0));
  const label = (id: string) => `${id.slice(0, 8)}${id.includes('@bp:') ? ` ${id.split('@bp:')[1]}` : ''}`;
  const at = (ms: number | null | undefined) => (ms == null ? '' : `${Math.round(ms)}`);
  const left = (ms: number) => `${(100 * ms) / end}%`;

  function onTop(node: HTMLElement) {
    node.showPopover?.();
  }

  async function copy() {
    await navigator.clipboard.writeText(JSON.stringify({ url: location.pathname, at: new Date().toISOString(), userAgent: navigator.userAgent, ...read() }, null, 2));
    copied = true;
  }
</script>

{#if report}
  <section class="load-timeline" data-testid="load-timeline" popover="manual" use:onTop>
    <header>
      <strong>load timeline</strong>
      <span>page {at(report.totals.page)} · first {at(report.totals.firstContent)} · last {at(report.totals.lastContent)} · all vectors {at(report.totals.allVectors)} · sharp {at(report.totals.sharp)} ms</span>
      <span>sources {Math.round(report.totals.sourceBytes / KB)} KB · images {Math.round(report.totals.imageBytes / KB)} KB</span>
      <button type="button" onclick={() => (report = read())}>refresh</button>
      <button type="button" onclick={copy}>{copied ? 'copied' : 'copy as JSON'}</button>
    </header>
    <ol class="bars">
      {#each report.sources as s}
        <li><span class="id">sources ×{s.ids}</span><span class="track"><span class="span source" style:left={left(s.start)} style:width={left(s.end - s.start)}></span></span><span class="num">{Math.round(s.bytes / KB)} KB</span></li>
      {/each}
      {#each report.frames as f}
        <li>
          <span class="id">{label(f.id)}</span>
          <span class="track">
            {#if f.steps.asked !== undefined && f.content !== null}
              <span class="span load" style:left={left(f.steps.asked)} style:width={left(f.content - f.steps.asked)}></span>
            {/if}
            {#if f.images.lastEnd !== null && f.steps.images !== undefined}
              <span class="span pictures" style:left={left(f.steps.images)} style:width={left(Math.max(0, f.images.lastEnd - f.steps.images))}></span>
            {/if}
            {#each Object.entries(f.steps) as [step, ms]}
              <span class="tick" title="{step} {at(ms)}" style:left={left(ms ?? 0)}></span>
            {/each}
          </span>
          <span class="num">{f.images.count} img · {Math.round(f.images.bytes / KB)} KB</span>
        </li>
      {/each}
    </ol>
    <table>
      <thead><tr><th>frame</th>{#each COLUMNS as c}<th>{c}</th>{/each}<th>img end</th></tr></thead>
      <tbody>
        {#each report.frames as f}
          <tr><td>{label(f.id)}</td>{#each COLUMNS as c}<td>{at(f.steps[c])}</td>{/each}<td>{at(f.images.lastEnd)}</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

<style>
  .load-timeline {
    position: fixed;
    inset: auto;
    margin: 0;
    border: 0;
    right: 12px;
    top: 56px;
    z-index: 2147483000;
    width: min(720px, calc(100vw - 32px));
    max-height: 70vh;
    overflow: auto;
    padding: 8px 10px;
    border-radius: var(--ui-radius-lg);
    font: 11px/1.4 ui-monospace, monospace;
    color: #fff;
    background: #111;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }

  button {
    padding: 2px 6px;
    border-radius: var(--ui-radius-sm);
    color: inherit;
    background: rgb(255 255 255 / 0.15);
  }

  .bars {
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }

  .bars li {
    display: grid;
    grid-template-columns: 90px 1fr 120px;
    gap: 6px;
    align-items: center;
    height: 14px;
  }

  .track {
    position: relative;
    height: 8px;
    background: rgb(255 255 255 / 0.08);
  }

  .span {
    position: absolute;
    top: 0;
    height: 100%;
  }

  .load {
    background: rgb(96 165 250 / 0.7);
  }

  .pictures {
    top: 5px;
    height: 3px;
    background: rgb(250 204 21 / 0.9);
  }

  .source {
    background: rgb(52 211 153 / 0.8);
  }

  .tick {
    position: absolute;
    top: -2px;
    width: 1px;
    height: 12px;
    background: #fff;
  }

  .num {
    text-align: right;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  td,
  th {
    padding: 1px 4px;
    text-align: right;
  }
</style>
