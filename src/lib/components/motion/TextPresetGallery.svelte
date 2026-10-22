<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { parseDecimal } from '$lib/motion/inspector';
  import { AnimatorUnit, SelectorShape } from '$lib/motion/text-animators/model';
  import { PRESETS, PRESET_LABEL, TEXT_PRESETS, applyPreset, type TextPreset } from '$lib/motion/text-animators/ops';
  import { startLook } from '$lib/motion/text-animators/preset-preview';
  import type { OpResult } from '$lib/motion/timeline';

  let { doc, clip, frame, commit }: { doc: MotionDoc; clip: MotionClip; frame: number; commit: (result: OpResult, summary: string) => void } = $props();

  const SAMPLE: Record<AnimatorUnit, string[]> = {
    [AnimatorUnit.Char]: ['M', 'o', 't', 'i', 'o', 'n'],
    [AnimatorUnit.Word]: ['Make', 'it', 'move'],
    [AnimatorUnit.Line]: ['Make it', 'move']
  };
  const DEFAULT_SECONDS = 1;
  const STAGGER_MS = 90;
  const SOFT_MS = 500;
  const HARD_MS = 1;

  let seconds = $state(String(DEFAULT_SECONDS));

  const length = $derived(parseDecimal(seconds) ?? DEFAULT_SECONDS);

  function add(preset: TextPreset) {
    const duration = Math.max(1, Math.round(length * doc.fps));
    commit(applyPreset(doc, clip.id, preset, { start: Math.max(0, frame - clip.from), duration }, crypto.randomUUID().slice(0, 8)), `Added ${PRESET_LABEL[preset]}`);
  }

  function tileStyle(preset: TextPreset): string {
    const { animator } = PRESETS[preset];
    const look = startLook(animator.values ?? {});
    const hard = animator.shape === SelectorShape.Square;
    return `--o:${look.opacity};--t:${look.transform};--f:${look.filter};--d:${hard ? HARD_MS : SOFT_MS}ms`;
  }
</script>

<section class="gallery" data-testid="text-preset-gallery">
  <div class="head">
    <h4>Text animation</h4>
    <label>Length (s)<input type="text" inputmode="decimal" aria-label="Preset length" bind:value={seconds} /></label>
  </div>
  <div class="tiles">
    {#each TEXT_PRESETS as preset (preset)}
      <button type="button" class="tile" data-preset={preset} title={PRESETS[preset].about} style={tileStyle(preset)} onclick={() => add(preset)}>
        <span class="sample" data-unit={PRESETS[preset].animator.unit} aria-hidden="true">
          {#each SAMPLE[PRESETS[preset].animator.unit] as part, i (i)}<span class="u" style={`--i:${i}`}>{part}</span>{/each}
        </span>
        <span class="name">{PRESET_LABEL[preset]}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
  }

  .head label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--ui-ink-2);
  }

  .head input {
    width: 36px;
    padding: 1px 3px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 2px 4px;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
    overflow: hidden;
  }

  .tile:hover {
    border-color: var(--ui-accent);
  }

  .sample {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25em;
    height: 2.6em;
    align-content: center;
    font-size: 11px;
    font-weight: 600;
    color: var(--ui-ink);
  }

  .sample[data-unit='char'] {
    gap: 0;
  }

  .u {
    display: inline-block;
  }

  .tile:hover .u {
    animation: preview var(--d) both;
    animation-delay: calc(var(--i) * 90ms);
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  }

  .name {
    font-size: 9px;
    color: var(--ui-ink-2);
    text-align: center;
  }

  @keyframes preview {
    from {
      opacity: var(--o);
      transform: var(--t);
      filter: var(--f);
    }

    to {
      opacity: 1;
      transform: none;
      filter: none;
    }
  }
</style>
