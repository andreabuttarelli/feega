<script lang="ts">
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import type { EaseSpec } from '@feega/motion-core/motion/keyframes';
  import { Ease } from '@feega/motion-core/motion/design';
  import { bezierOf } from '@feega/motion-core/motion/graph';
  import { DEFAULT_STATE_MS, ElementState, MAX_STATE_MS, OVERRIDE_KEYS, STATE_LABEL, type OverrideKey, type StateRow } from '@feega/motion-core/motion/states/model';
  import { putState, removeState } from '$lib/motion/states/ops';
  import { OVERRIDE_FIELD, FieldKind, seedOf } from '$lib/motion/states/fields';
  import EasePicker from './EasePicker.svelte';

  const SWITCHER = [ElementState.Default, ElementState.Hover, ElementState.Pressed, ElementState.Focus] as const;
  const CURVE_PX = 40;

  let { doc, clip, current, commit, onpreview }: { doc: MotionDoc; clip: MotionClip; current: ElementState; commit: (result: OpResult, summary: string) => void; onpreview: (state: ElementState) => void } = $props();

  let picking = $state(false);

  const row = $derived(clip.states?.find((r) => r.state === current) ?? null);
  const unset = $derived(OVERRIDE_KEYS.filter((k) => row?.overrides[k] === undefined));
  const curve = $derived(row ? bezierOf(row.transition.easing) : null);
  const curvePath = $derived(curve ? `M0 ${CURVE_PX} C${curve[0] * CURVE_PX} ${(1 - curve[1]) * CURVE_PX} ${curve[2] * CURVE_PX} ${(1 - curve[3]) * CURVE_PX} ${CURVE_PX} 0` : '');

  const put = (next: StateRow, summary: string) => commit(putState(doc, clip.id, next), summary);

  function setOverride(key: OverrideKey, raw: string) {
    if (!row) {
      return;
    }
    const value = OVERRIDE_FIELD[key].kind === FieldKind.Colour ? raw : Number(raw);
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return;
    }
    put({ ...row, overrides: { ...row.overrides, [key]: value } }, `Changed ${STATE_LABEL[current]} ${OVERRIDE_FIELD[key].label}`);
  }

  function dropOverride(key: OverrideKey) {
    if (!row) {
      return;
    }
    const { [key]: _dropped, ...rest } = row.overrides;
    put({ ...row, overrides: rest }, `Removed ${OVERRIDE_FIELD[key].label} from ${STATE_LABEL[current]}`);
  }

  function addOverride(key: OverrideKey) {
    if (row) {
      put({ ...row, overrides: { ...row.overrides, [key]: seedOf(clip, key) } }, `Added ${OVERRIDE_FIELD[key].label} to ${STATE_LABEL[current]}`);
    }
  }

  const setEase = (easing: EaseSpec) => row && put({ ...row, transition: { ...row.transition, easing } }, 'Changed the state curve');

  function setDuration(raw: string) {
    const ms = Math.round(Number(raw));
    if (row && Number.isFinite(ms)) {
      put({ ...row, transition: { ...row.transition, durationMs: Math.min(MAX_STATE_MS, Math.max(0, ms)) } }, 'Changed the state duration');
    }
  }
</script>

<section class="states" data-testid="states-section" aria-label="States">
  <header><h3>States</h3></header>
  <div class="switcher" role="radiogroup" aria-label="Preview state" data-testid="state-switcher">
    {#each SWITCHER as option (option)}
      <button type="button" role="radio" aria-checked={current === option} class:on={current === option} class:has={option !== ElementState.Default && clip.states?.some((r) => r.state === option)} data-state={option} onclick={() => onpreview(option)}>{STATE_LABEL[option]}</button>
    {/each}
  </div>

  {#if current === ElementState.Default}
    <p class="hint">The layer as drawn. Pick Hover, Pressed or Focus to change how it looks in that state.</p>
  {:else if !row}
    <button type="button" class="add" data-testid="state-add" onclick={() => put({ state: current, overrides: { opacity: seedOf(clip, 'opacity') as number }, transition: { easing: Ease.Standard, durationMs: DEFAULT_STATE_MS } }, `Added a ${STATE_LABEL[current]} state`)}>Add {STATE_LABEL[current]} state</button>
  {:else}
    {#each OVERRIDE_KEYS.filter((k) => row.overrides[k] !== undefined) as key (key)}
      <div class="line" data-override={key}>
        <span class="label">{OVERRIDE_FIELD[key].label}</span>
        {#if OVERRIDE_FIELD[key].kind === FieldKind.Colour}
          <input type="color" aria-label={OVERRIDE_FIELD[key].label} value={String(row.overrides[key])} onchange={(e) => setOverride(key, e.currentTarget.value)} />
        {:else}
          <input type="text" inputmode="decimal" aria-label={OVERRIDE_FIELD[key].label} value={String(row.overrides[key])} onchange={(e) => setOverride(key, e.currentTarget.value)} />
        {/if}
        <button type="button" class="remove" aria-label={`Remove ${OVERRIDE_FIELD[key].label}`} onclick={() => dropOverride(key)}>×</button>
      </div>
    {/each}
    {#if unset.length}
      <select aria-label="Add property" value="" onchange={(e) => addOverride(e.currentTarget.value as OverrideKey)}>
        <option value="" disabled>Add property…</option>
        {#each unset as key (key)}<option value={key}>{OVERRIDE_FIELD[key].label}</option>{/each}
      </select>
    {/if}
    <div class="line transition" data-testid="state-transition">
      <button type="button" class="curve" aria-label="Edit the curve" onclick={() => (picking = !picking)}>
        <svg width={CURVE_PX} height={CURVE_PX} viewBox={`0 0 ${CURVE_PX} ${CURVE_PX}`} aria-hidden="true"><path d={curvePath} /></svg>
      </button>
      <input type="text" inputmode="numeric" aria-label="Duration in milliseconds" value={String(row.transition.durationMs)} onchange={(e) => setDuration(e.currentTarget.value)} />
      <span class="hint">ms</span>
      <button type="button" class="remove" aria-label={`Remove the ${STATE_LABEL[current]} state`} onclick={() => commit(removeState(doc, clip.id, row.state), `Removed the ${STATE_LABEL[current]} state`)}>Remove</button>
    </div>
    {#if picking}
      <div class="picker" data-testid="state-curve-picker">
        <EasePicker ease={row.transition.easing} onpick={(e) => setEase(e)} onclose={() => (picking = false)} />
      </div>
    {/if}
  {/if}
</section>

<style>
  .states {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-border);
    font-size: var(--ui-type-caption);
  }

  h3 {
    margin: 0;
    font-size: var(--ui-type-caption);
    font-weight: 600;
  }

  .switcher {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface-sunken, var(--ui-border));
  }

  .switcher button {
    position: relative;
    padding: var(--ui-space-1) 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    font: inherit;
    cursor: pointer;
  }

  .switcher button.on {
    background: var(--ui-surface, #fff);
    color: var(--ui-text);
  }

  .switcher button.has::after {
    content: '';
    position: absolute;
    top: 3px;
    right: 3px;
    width: 4px;
    height: 4px;
    border-radius: var(--ui-radius-full, 999px);
    background: var(--ui-accent, #0099ff);
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--ui-space-1);
  }

  .label {
    flex: 1;
  }

  input[type='text'] {
    width: 64px;
  }

  .curve {
    padding: 2px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    cursor: pointer;
  }

  .curve path {
    fill: none;
    stroke: var(--ui-accent, #0099ff);
    stroke-width: 2;
  }

  .remove,
  .add {
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    font: inherit;
    cursor: pointer;
  }

  .picker {
    position: relative;
    min-height: 260px;
  }

  .transition .remove {
    margin-left: auto;
  }

  .hint {
    margin: 0;
    color: var(--ui-text-secondary);
  }
</style>
