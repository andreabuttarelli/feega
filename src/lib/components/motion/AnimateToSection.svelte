<script lang="ts">
  import { ANIMATE_TO_KEYS, animateTo } from '$lib/motion/animate-to';
  import { EASE_IDS, EASE_LABEL, Ease } from '@feega/motion-core/motion/design';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import { withParams } from '@feega/motion-core/motion/custom/params';
  import { parseDecimal, valueAt } from '$lib/motion/inspector';
  import { TRANSFORM, type TransformKey } from '@feega/motion-core/motion/keyframes';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { toShown, toStored, unitOf } from '$lib/motion/units';

  let { doc, clip, frame, commit }: { doc: MotionDoc; clip: MotionClip; frame: number; commit: (result: OpResult, summary: string) => void } = $props();

  const DEFAULT_SECONDS = 1;
  const identity = (color: string) => color;

  let key = $state<TransformKey>('opacity');
  let target = $state('');
  let seconds = $state(String(DEFAULT_SECONDS));
  let ease = $state<Ease>(Ease.Standard);

  const start = $derived(Math.max(0, frame - clip.from));
  const current = $derived(Number(valueAt(withParams(doc, clip), key, clip.from + start, identity) ?? 0));
  const shownNow = $derived(toShown(clip.component, key, current, doc));
  const unit = $derived(unitOf(clip.component, key) ?? '');

  function run() {
    const shown = parseDecimal(target);
    if (shown === null) {
      return;
    }
    const duration = Math.max(1, Math.round((parseDecimal(seconds) ?? DEFAULT_SECONDS) * doc.fps));
    commit(animateTo(doc, clip.id, { [key]: toStored(clip.component, key, shown, doc) }, { start, duration, ease }, identity), `Animated ${TRANSFORM[key].label} to ${shown}`);
    target = '';
  }
</script>

<section class="to" data-testid="animate-to">
  <h4>Animate to</h4>
  <div class="row">
    <select aria-label="Animate property" bind:value={key}>
      {#each ANIMATE_TO_KEYS as k (k)}<option value={k}>{TRANSFORM[k].label}</option>{/each}
    </select>
    <input type="text" inputmode="decimal" aria-label="Animate target" placeholder={`${shownNow}${unit}`} bind:value={target} onkeydown={(e) => e.key === 'Enter' && run()} />
  </div>
  <div class="row">
    <label>Length (s)<input type="text" inputmode="decimal" aria-label="Animate length" bind:value={seconds} /></label>
    <select aria-label="Animate ease" bind:value={ease}>
      {#each EASE_IDS as id (id)}<option value={id}>{EASE_LABEL[id]}</option>{/each}
    </select>
    <button type="button" data-testid="animate-to-run" disabled={parseDecimal(target) === null} onclick={run}>Animate</button>
  </div>
</section>

<style>
  .to {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  label {
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--ui-ink-2);
  }

  input,
  select,
  button {
    min-width: 0;
    padding: 2px 4px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  input[aria-label='Animate target'] {
    flex: 1;
  }

  input[aria-label='Animate length'] {
    width: 34px;
  }

  button:disabled {
    opacity: 0.4;
  }
</style>
