<script lang="ts">
  import { ASPECT_PRESETS, aspectSchema, type Focus } from '$lib/reframe';

  let { medium, onapply, onclose }: { medium: 'image' | 'video'; onapply: (aspect: string, focus: Focus) => void; onclose: () => void } = $props();

  const CUSTOM = 'custom';
  const PERCENT = 100;
  const FOCUS_STEP = 1;

  let choice = $state<string>(ASPECT_PRESETS[0]);
  let custom = $state('');
  let focusX = $state(50);
  let focusY = $state(50);

  const aspect = $derived(choice === CUSTOM ? custom.trim() : choice);
  const ready = $derived(aspectSchema.safeParse(aspect).success);

  function apply() {
    if (ready) {
      onapply(aspect, { x: focusX / PERCENT, y: focusY / PERCENT });
      onclose();
    }
  }
</script>

<div class="rf-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="rf-card" role="dialog" aria-modal="true" aria-label="Reframe" data-testid="reframe-dialog">
    <h3>Reframe</h3>
    <p class="rf-hint">{medium === 'image' ? 'The picture grows to the new aspect and the new area is painted in (spends credits).' : 'The video is cropped to the new aspect around the focus point.'}</p>
    <div class="rf-aspects">
      {#each [...ASPECT_PRESETS, CUSTOM] as option (option)}
        <button class="rf-chip" class:on={choice === option} type="button" onclick={() => (choice = option)} data-testid={`reframe-${option}`}>{option}</button>
      {/each}
    </div>
    {#if choice === CUSTOM}
      <input class="rf-custom" bind:value={custom} placeholder="w:h, like 21:9" aria-label="Custom aspect" data-testid="reframe-custom" />
    {/if}
    {#if medium === 'video'}
      <label class="rf-row"><span>Focus left to right</span><input type="range" min="0" max={PERCENT} step={FOCUS_STEP} bind:value={focusX} data-testid="reframe-focus-x" /></label>
      <label class="rf-row"><span>Focus top to bottom</span><input type="range" min="0" max={PERCENT} step={FOCUS_STEP} bind:value={focusY} data-testid="reframe-focus-y" /></label>
    {/if}
    <div class="rf-actions">
      <button class="rf-btn" type="button" onclick={onclose}>Cancel</button>
      <button class="rf-btn primary" type="button" disabled={!ready} onclick={apply} data-testid="reframe-apply">Reframe</button>
    </div>
  </div>
</div>

<style>
  .rf-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .rf-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 360px; border-radius: var(--ui-radius-lg); box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 10px; }
  .rf-card h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .rf-hint { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .rf-aspects { display: flex; flex-wrap: wrap; gap: 6px; }
  .rf-chip { font: inherit; font-size: 13px; padding: 6px 10px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm); text-transform: capitalize; }
  .rf-chip.on { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .rf-custom { font: inherit; font-size: 13px; padding: 6px 8px; border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm); }
  .rf-row { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
  .rf-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
  .rf-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm); }
  .rf-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .rf-btn:disabled { opacity: 0.5; cursor: default; }
</style>
