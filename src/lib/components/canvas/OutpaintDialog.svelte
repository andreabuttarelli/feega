<script lang="ts">
  import type { Extend } from '$lib/outpaint';

  let { onapply, onclose }: { onapply: (prompt: string, extend: Extend) => void; onclose: () => void } = $props();

  const SIDES = ['top', 'right', 'bottom', 'left'] as const;
  const PERCENT = 100;
  const MAX_PERCENT = 100;

  let percents = $state<Record<(typeof SIDES)[number], number>>({ top: 0, right: 25, bottom: 0, left: 25 });
  let prompt = $state('');

  const extend = $derived<Extend>(Object.fromEntries(SIDES.map((side) => [side, Math.min(MAX_PERCENT, Math.max(0, percents[side] || 0)) / PERCENT])));
  const ready = $derived(prompt.trim().length > 0 && SIDES.some((side) => (extend[side] ?? 0) > 0));

  function apply() {
    if (ready) {
      onapply(prompt.trim(), extend);
      onclose();
    }
  }
</script>

<div class="op-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="op-card" role="dialog" aria-modal="true" aria-label="Outpaint" data-testid="outpaint-dialog">
    <h3>Outpaint</h3>
    <p class="op-hint">How far to grow each side, as a percentage of the picture.</p>
    {#each SIDES as side (side)}
      <label class="op-row"><span>{side}</span><input type="number" min="0" max={MAX_PERCENT} bind:value={percents[side]} data-testid={`outpaint-${side}`} />%</label>
    {/each}
    <textarea bind:value={prompt} rows="2" placeholder="What fills the new area?" aria-label="Prompt" data-testid="outpaint-prompt"></textarea>
    <div class="op-actions">
      <button class="op-btn" type="button" onclick={onclose}>Cancel</button>
      <button class="op-btn primary" type="button" disabled={!ready} onclick={apply} data-testid="outpaint-apply">Outpaint</button>
    </div>
  </div>
</div>

<style>
  .op-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .op-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 360px; border-radius: var(--ui-radius-lg); box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 8px; }
  .op-card h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .op-hint { margin: 0; font-size: 13px; color: var(--ink-soft, #6e6e73); }
  .op-row { display: flex; align-items: center; gap: 8px; font-size: 13.5px; text-transform: capitalize; }
  .op-row span { width: 60px; }
  .op-row input { width: 80px; font: inherit; font-size: 13px; padding: 4px 6px; border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm); }
  .op-card textarea { font: inherit; font-size: 14px; padding: 8px; border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm); resize: vertical; }
  .op-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
  .op-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); border-radius: var(--ui-radius-sm); }
  .op-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .op-btn:disabled { opacity: 0.5; cursor: default; }
</style>
