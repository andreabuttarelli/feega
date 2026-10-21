<script lang="ts">
  import ExportRows from '$lib/components/motion/ExportRows.svelte';
  import type { ExportRow } from '$lib/motion/export-rows';

  type Made = { url: string; name: string; files: string[] };

  let { count, onexport, onclose }: { count: number; onexport: (rows: ExportRow[]) => Promise<Made | string>; onclose: () => void } = $props();
</script>

<div class="fx-overlay" role="button" tabindex="-1" aria-label="Cancel" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={(e) => e.key === 'Escape' && onclose()}>
  <div class="fx-card" role="dialog" aria-modal="true" aria-label="Export" data-testid="export-dialog">
    <ExportRows {count} {onexport} {onclose} />
  </div>
</div>

<style>
  .fx-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; padding: 16px; }
  .fx-card { background: var(--paper, #fff); padding: 22px; width: 100%; max-width: 520px; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.4); }
</style>
