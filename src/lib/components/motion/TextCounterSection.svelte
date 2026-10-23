<script lang="ts">
  import { EASE_IDS, EASE_LABEL } from '$lib/motion/design';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { parseDecimal } from '$lib/motion/inspector';
  import { COUNTER_COMPONENT, COUNTER_FORMATS, COUNTER_FORMAT_LABEL, CounterFormat, counterSchema, type Counter } from '$lib/motion/text-counter';
  import { setTextCounter, type CounterInput } from '$lib/motion/text-counter-ops';
  import type { OpResult } from '$lib/motion/timeline';

  let { doc, clip, commit }: { doc: MotionDoc; clip: MotionClip; commit: (result: OpResult, summary: string) => void } = $props();

  const START_COUNTER: CounterInput = { from: 0, to: 100 };
  const SUMMARY = 'Changed the counter';

  const counter = $derived(clip.props.counter as Counter | undefined);
  const secondsOf = (frames: number) => String(Math.round((frames / doc.fps) * 100) / 100);

  function patch(input: Partial<Counter>) {
    commit(setTextCounter(doc, clip.id, { ...(counter ?? counterSchema.parse(START_COUNTER)), ...input }), SUMMARY);
  }

  function typed(field: 'from' | 'to', text: string) {
    const value = parseDecimal(text);
    if (value !== null) {
      patch({ [field]: value });
    }
  }

  function timed(field: 'start' | 'duration', text: string) {
    const value = parseDecimal(text);
    if (value !== null) {
      patch({ [field]: Math.max(field === 'duration' ? 1 : 0, Math.round(value * doc.fps)) });
    }
  }

  function toggle(on: boolean) {
    commit(setTextCounter(doc, clip.id, on ? START_COUNTER : null), on ? 'Added a counter' : 'Removed the counter');
  }
</script>

{#if clip.component === COUNTER_COMPONENT}
  <section class="counter" data-testid="text-counter-section">
    <label class="head"><input type="checkbox" checked={!!counter} aria-label="Count up" onchange={(e) => toggle(e.currentTarget.checked)} />Counter</label>
    {#if counter}
      <div class="grid">
        <label>From<input type="text" inputmode="decimal" aria-label="Counter from" value={String(counter.from)} onchange={(e) => typed('from', e.currentTarget.value)} /></label>
        <label>To<input type="text" inputmode="decimal" aria-label="Counter to" value={String(counter.to)} onchange={(e) => typed('to', e.currentTarget.value)} /></label>
        <label>Format
          <select aria-label="Counter format" value={counter.format} onchange={(e) => patch({ format: e.currentTarget.value as CounterFormat })}>
            {#each COUNTER_FORMATS as format (format)}<option value={format}>{COUNTER_FORMAT_LABEL[format]}</option>{/each}
          </select>
        </label>
        <label>Decimals<input type="number" min="0" max="6" step="1" aria-label="Counter decimals" value={counter.decimals} onchange={(e) => patch({ decimals: Number(e.currentTarget.value) })} /></label>
        <label>Start (s)<input type="text" inputmode="decimal" aria-label="Counter start" value={secondsOf(counter.start)} onchange={(e) => timed('start', e.currentTarget.value)} /></label>
        <label>Length (s)<input type="text" inputmode="decimal" aria-label="Counter length" value={secondsOf(counter.duration)} onchange={(e) => timed('duration', e.currentTarget.value)} /></label>
        <label>Ease
          <select aria-label="Counter ease" value={counter.ease} onchange={(e) => patch({ ease: e.currentTarget.value as Counter['ease'] })}>
            {#each EASE_IDS as ease (ease)}<option value={ease}>{EASE_LABEL[ease]}</option>{/each}
          </select>
        </label>
      </div>
    {/if}
  </section>
{/if}

<style>
  .counter {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 11px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .grid label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--ui-ink-2);
  }

  .grid input,
  .grid select {
    min-width: 0;
    padding: 2px 4px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }
</style>
