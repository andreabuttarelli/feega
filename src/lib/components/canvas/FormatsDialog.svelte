<script lang="ts">
  import { FORMATS } from '$lib/motion/doc';
  import { CREATE_FORMATS, type FormatTarget } from '$lib/motion/reformat';

  let { oncreate, onclose }: { oncreate: (targets: FormatTarget[]) => void; onclose: () => void } = $props();

  let picked = $state(new Set(CREATE_FORMATS));
  let custom = $state(false);
  let width = $state(1200);
  let height = $state(628);

  const targets = $derived<FormatTarget[]>([...CREATE_FORMATS.filter((f) => picked.has(f)).map((format) => ({ format })), ...(custom ? [{ size: { width, height } }] : [])]);

  function toggle(format: (typeof CREATE_FORMATS)[number]) {
    const next = new Set(picked);
    if (!next.delete(format)) {
      next.add(format);
    }
    picked = next;
  }

  function create() {
    oncreate(targets);
    onclose();
  }
</script>

<div class="fx-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="fx-card" role="dialog" aria-modal="true" aria-label="Create formats" data-testid="formats-dialog">
    <h3>Create formats</h3>
    {#each CREATE_FORMATS as format (format)}
      <label class="fx-row"><input type="checkbox" checked={picked.has(format)} onchange={() => toggle(format)} data-testid={`format-${format}`} />{FORMATS[format].label}<span>{FORMATS[format].width} × {FORMATS[format].height}</span></label>
    {/each}
    <label class="fx-row"><input type="checkbox" bind:checked={custom} data-testid="format-custom" />Custom</label>
    {#if custom}
      <div class="fx-size">
        <input type="number" min="16" max="1920" aria-label="Width" bind:value={width} />
        <span>×</span>
        <input type="number" min="16" max="1920" aria-label="Height" bind:value={height} />
      </div>
    {/if}
    <div class="fx-actions">
      <button class="fx-btn" type="button" onclick={onclose}>Cancel</button>
      <button class="fx-btn primary" type="button" disabled={!targets.length} onclick={create} data-testid="formats-create">Create</button>
    </div>
  </div>
</div>

<style>
  .fx-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 24px; }
  .fx-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 360px; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 8px; }
  .fx-card h3 { margin: 0 0 6px; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .fx-row { display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
  .fx-row span { margin-left: auto; color: var(--ink-soft, #6e6e73); font-size: 12px; }
  .fx-size { display: flex; align-items: center; gap: 6px; padding-left: 24px; }
  .fx-size input { width: 80px; font: inherit; font-size: 13px; padding: 4px 6px; border: 1px solid var(--line, #e3e3e6); }
  .fx-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 12px; }
  .fx-btn { font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 14px; cursor: pointer; background: var(--paper-2, #f5f5f7); color: var(--ink, #1d1d1f); border: 1px solid var(--line, #e3e3e6); }
  .fx-btn.primary { background: var(--ink, #1d1d1f); color: var(--paper, #fff); }
  .fx-btn:disabled { opacity: 0.5; cursor: default; }
</style>
