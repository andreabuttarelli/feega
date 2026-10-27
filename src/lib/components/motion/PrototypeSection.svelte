<script lang="ts">
  import { EASE_IDS, EASE_LABEL } from '@feega/motion-core/motion/design';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import {
    ACTION_KINDS,
    ACTION_LABEL,
    ActionKind,
    DEFAULT_DELAY_MS,
    DEFAULT_DURATION_MS,
    DIRECTIONS,
    DIRECTION_LABEL,
    Direction,
    TRANSITION_KINDS,
    TRANSITION_LABEL,
    TRIGGER_KINDS,
    TRIGGER_LABEL,
    TransitionKind,
    TriggerKind,
    needsTarget,
    type Interaction
  } from '@feega/motion-core/motion/prototype/model';
  import { prototypeLink } from '$lib/canvas/prototype-link.svelte';
  import { putInteraction, removeInteraction } from '$lib/motion/prototype/ops';
  import { TRANSITION_FIELDS, retimed, retriggered, retargeted } from '$lib/motion/prototype/edit';

  let { doc, clip, commit }: { doc: MotionDoc; clip: MotionClip; commit: (result: OpResult, summary: string) => void } = $props();

  const interactions = $derived(clip.interactions ?? []);
  const aiming = $derived(prototypeLink.draft?.clipId === clip.id);
  const nameOf = (id: string) => prototypeLink.targets.find((t) => t.id === id)?.name ?? 'Missing frame';
  const targetOf = (i: Interaction) => ('target' in i.action ? i.action.target : '');
  const put = (next: Interaction, summary: string) => commit(putInteraction(doc, clip.id, next), summary);
  const ms = (text: string, fallback: number) => (Number.isFinite(Number(text)) && text.trim() !== '' ? Math.round(Number(text)) : fallback);
</script>

<section class="prototype" data-testid="prototype-section" aria-label="Prototype">
  <header>
    <h3>Prototype</h3>
    <button type="button" class="link" data-testid="prototype-link" aria-pressed={aiming} onclick={() => (aiming ? prototypeLink.stop() : prototypeLink.aim({ clipId: clip.id, interactionId: null }))}>
      {aiming ? 'Cancel' : 'Link to frame'}
    </button>
  </header>
  {#if aiming}
    <p class="hint" data-testid="prototype-hint">Click the frame this layer should open.</p>
  {/if}
  {#each interactions as interaction (interaction.id)}
    <div class="row" data-interaction={interaction.id}>
      <div class="line">
        <select aria-label="Trigger" value={interaction.trigger.kind} onchange={(e) => put(retriggered(interaction, e.currentTarget.value as TriggerKind), 'Changed the trigger')}>
          {#each TRIGGER_KINDS as kind (kind)}<option value={kind}>{TRIGGER_LABEL[kind]}</option>{/each}
        </select>
        {#if interaction.trigger.kind === TriggerKind.AfterDelay}
          <input type="text" inputmode="numeric" aria-label="Delay in milliseconds" value={String(interaction.trigger.delayMs)} onchange={(e) => put({ ...interaction, trigger: { kind: TriggerKind.AfterDelay, delayMs: ms(e.currentTarget.value, DEFAULT_DELAY_MS) } }, 'Changed the delay')} />
        {/if}
        <button type="button" class="remove" aria-label="Remove interaction" onclick={() => commit(removeInteraction(doc, clip.id, interaction.id), 'Removed an interaction')}>Remove</button>
      </div>
      <div class="line">
        <select aria-label="Action" value={interaction.action.kind} onchange={(e) => put(retargeted(interaction, e.currentTarget.value as ActionKind, targetOf(interaction) || prototypeLink.targets[0]?.id || ''), 'Changed the action')}>
          {#each ACTION_KINDS as kind (kind)}<option value={kind}>{ACTION_LABEL[kind]}</option>{/each}
        </select>
        {#if needsTarget(interaction.action.kind)}
          <select aria-label="Target frame" value={targetOf(interaction)} onchange={(e) => put(retargeted(interaction, interaction.action.kind, e.currentTarget.value), 'Changed the target frame')}>
            {#if !prototypeLink.targets.some((t) => t.id === targetOf(interaction))}<option value={targetOf(interaction)}>{nameOf(targetOf(interaction))}</option>{/if}
            {#each prototypeLink.targets as target (target.id)}<option value={target.id}>{target.name}</option>{/each}
          </select>
          <button type="button" class="aim" aria-label="Pick the target on the canvas" onclick={() => prototypeLink.aim({ clipId: clip.id, interactionId: interaction.id })}>Pick</button>
        {/if}
      </div>
      <div class="line">
        <select aria-label="Transition" value={interaction.transition.kind} onchange={(e) => put(retimed(interaction, { kind: e.currentTarget.value as TransitionKind }), 'Changed the transition')}>
          {#each TRANSITION_KINDS as kind (kind)}<option value={kind}>{TRANSITION_LABEL[kind]}</option>{/each}
        </select>
        {#if TRANSITION_FIELDS[interaction.transition.kind].direction && 'direction' in interaction.transition}
          <select aria-label="Direction" value={interaction.transition.direction} onchange={(e) => put(retimed(interaction, { direction: e.currentTarget.value as Direction }), 'Changed the direction')}>
            {#each DIRECTIONS as direction (direction)}<option value={direction}>{DIRECTION_LABEL[direction]}</option>{/each}
          </select>
        {/if}
      </div>
      {#if TRANSITION_FIELDS[interaction.transition.kind].timing && 'durationMs' in interaction.transition}
        <div class="line">
          <select aria-label="Easing" value={interaction.transition.easing} onchange={(e) => put(retimed(interaction, { easing: e.currentTarget.value as (typeof EASE_IDS)[number] }), 'Changed the easing')}>
            {#each EASE_IDS as ease (ease)}<option value={ease}>{EASE_LABEL[ease]}</option>{/each}
          </select>
          <input type="text" inputmode="numeric" aria-label="Duration in milliseconds" value={String(interaction.transition.durationMs)} onchange={(e) => put(retimed(interaction, { durationMs: Math.max(1, ms(e.currentTarget.value, DEFAULT_DURATION_MS)) }), 'Changed the duration')} />
          <span class="unit">ms</span>
        </div>
      {/if}
    </div>
  {/each}
  {#if !interactions.length && !aiming}
    <p class="hint">No interactions. Link this layer to another frame, or press Link to frame and click the target on the canvas.</p>
  {/if}
</section>

<style>
  .prototype {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-border);
    font-size: var(--ui-type-caption);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h3 {
    margin: 0;
    font-size: var(--ui-type-caption);
    font-weight: 600;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    padding: var(--ui-space-2);
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--ui-space-1);
  }

  select,
  input {
    min-width: 0;
    flex: 1;
  }

  input {
    max-width: 64px;
  }

  .hint,
  .unit {
    margin: 0;
    color: var(--ui-text-secondary);
  }
</style>
