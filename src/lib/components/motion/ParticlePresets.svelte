<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { PARTICLE_PRESETS, PRESET_PROPS, applyParticlePreset, type ParticlePreset } from '$lib/motion/particles/presets';

  let { doc, clip, onchange }: { doc: MotionDoc; clip: MotionClip; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let error = $state('');

  function apply(preset: ParticlePreset) {
    const result = applyParticlePreset(doc, clip.id, preset);
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, `Particles: ${preset}`);
  }
</script>

<section class="presets" data-testid="particle-presets">
  <h4>Particle preset</h4>
  <div class="buttons">
    {#each PARTICLE_PRESETS as preset (preset)}
      <button type="button" title={PRESET_PROPS[preset].about} data-preset={preset} onclick={() => apply(preset)}>{preset}</button>
    {/each}
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .presets {
    padding: var(--ui-space-2) var(--ui-space-3) var(--ui-space-3);
    border-top: 1px solid var(--ui-line);
    font-size: var(--ui-text-sm);
  }

  h4 {
    margin: 0 0 var(--ui-space-1);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ui-ink-2);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-1);
  }

  button {
    padding: var(--ui-space-1) var(--ui-space-2);
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
    text-transform: capitalize;
  }

  button:hover {
    background: var(--ui-hover);
  }

  .error {
    margin: var(--ui-space-1) 0 0;
    color: var(--ui-ink);
  }
</style>
